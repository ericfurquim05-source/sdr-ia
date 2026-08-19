import { garantirTabelas, sql } from "@/lib/db";
import { montarNumeroDestino } from "@/lib/retell";

/*
 * ============================================================
 * WORKER DA FILA — PEGA 1 PENDENTE DO CLIENTE E LIGA
 * ============================================================
 * Regra: UMA ligação ativa por cliente. O próximo contato só é
 * discado quando o webhook devolve a vez (call_ended).
 * Clientes diferentes discam em paralelo, sem se atrapalhar.
 *
 * FOR UPDATE SKIP LOCKED garante que duas execuções simultâneas
 * nunca peguem o mesmo contato.
 */

const LIMITE_TENTATIVAS = 7;

/*
 * COMO O REDIAL FUNCIONA
 * O sistema insiste no MESMO número até resolver, uma ligação por vez:
 *
 *   liga → aguarda encerrar → classifica o desfecho
 *     ├─ atendeu e falou > 13s  → CONCLUIDA, vai para o próximo contato
 *     └─ não atendeu, caiu em 3s, caixa postal → LIGA DE NOVO no mesmo
 *        número, até 7 tentativas; na 7ª vira ESGOTADO e segue adiante
 *
 * Nunca há duas ligações simultâneas: a próxima só sai quando o webhook
 * confirma o fim da anterior.
 *
 * MINUTOS_ENTRE_TENTATIVAS: pausa entre as tentativas do mesmo número.
 * Padrão 0 = redisca imediatamente. Se algum dia quiser espaçar (ou
 * intercalar com outros contatos), basta subir esse valor na Vercel.
 */
const MINUTOS_ENTRE_TENTATIVAS = Number(process.env.MINUTOS_ENTRE_TENTATIVAS || 20);

/** Busca o agent_id do cliente; cai no agente global se não houver. */
async function agentIdDoCliente(clienteId, tipo) {
  const { rows } = await sql`
    SELECT retell_agent_id, from_number FROM agentes
    WHERE cliente_id = ${clienteId} AND tipo = ${tipo} LIMIT 1;
  `;
  if (rows.length) {
    return { agentId: rows[0].retell_agent_id, fromNumber: rows[0].from_number || process.env.RETELL_FROM_NUMBER };
  }
  // Fallback: agentes globais das variáveis de ambiente
  return {
    agentId: tipo === "quente" ? process.env.RETELL_AGENT_QUENTE_ID : process.env.RETELL_AGENT_FRIO_ID,
    fromNumber: process.env.RETELL_FROM_NUMBER,
  };
}

export async function processarProximoDaFila(clienteId) {
  await garantirTabelas();

  // Há vaga livre? Nunca ultrapassa o limite de chamadas simultâneas.
  const { rows: ativas } = await sql`
    SELECT COUNT(*)::int AS total FROM contatos
    WHERE cliente_id = ${clienteId} AND status = 'EM_LIGACAO';
  `;
  if ((ativas[0]?.total ?? 0) >= CONCORRENCIA_MAXIMA) {
    return { disparou: false, motivo: "concorrencia_cheia", ativas: ativas[0].total };
  }

  // Pega o próximo: insiste no número que já começou, antes de abrir outro
  const { rows } = await sql`
    UPDATE contatos SET status = 'EM_LIGACAO', atualizado_em = NOW()
    WHERE id = (
      SELECT id FROM contatos
      WHERE cliente_id = ${clienteId}
        AND status = 'PENDENTE'
        AND tentativas < ${LIMITE_TENTATIVAS}
        AND proxima_tentativa <= NOW()          -- respeita a espera do redial
      ORDER BY
        -- 1) Quem já teve tentativa continua na frente: resolve um número
        --    por vez, em vez de espalhar meia ligação por toda a lista
        CASE WHEN tentativas > 0 THEN 0 ELSE 1 END ASC,
        -- 2) Entre os que já tentaram, o que acabou de falhar vem primeiro
        atualizado_em DESC,
        -- 3) Contatos novos seguem a ordem da planilha
        id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, nome, telefone, tentativas, agente;
  `;

  if (rows.length === 0) {
    // Ninguém liberado agora: pode ser fila vazia ou todos em espera
    const { rows: espera } = await sql`
      SELECT MIN(proxima_tentativa) AS proxima FROM contatos
      WHERE cliente_id = ${clienteId} AND status = 'PENDENTE' AND tentativas < ${LIMITE_TENTATIVAS};
    `;
    if (espera[0]?.proxima) {
      return { disparou: false, motivo: "aguardando_intervalo", proximaTentativa: espera[0].proxima };
    }
    return { disparou: false, motivo: "fila_vazia" };
  }

  const contato = rows[0];
  const { agentId, fromNumber } = await agentIdDoCliente(clienteId, contato.agente);

  if (!agentId) {
    return await registrarFalha(contato.id, "agente_nao_configurado");
  }

  const numeroDestino = montarNumeroDestino(contato.telefone);

  try {
    const resposta = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_number: fromNumber,
        to_number: numeroDestino,
        override_agent_id: agentId,
        // Equivale ao "Keep raw input" do painel da Retell: sem isso, ela
        // tenta normalizar o número para E.164 e rejeita a discagem com
        // prefixo de tronco SIP (ex.: 968655 + DDD + número).
        // Só tem efeito em telefonia customizada, que é o nosso caso.
        ignore_e164_validation: true,
        retell_llm_dynamic_variables: { nome: contato.nome || "" },
        // Volta no webhook: é como reencontramos o contato e o cliente
        metadata: { contato_id: contato.id, cliente_id: clienteId },
      }),
    });

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 250);
      // Registra de/para junto do erro: quase todo problema aqui é formato de número
      return await registrarFalha(
        contato.id,
        `HTTP ${resposta.status} | de ${fromNumber} para ${numeroDestino} | ${detalhe}`
      );
    }

    const dados = await resposta.json();
    await sql`
      UPDATE contatos SET call_id = ${dados.call_id ?? null}, atualizado_em = NOW()
      WHERE id = ${contato.id};
    `;
    return { disparou: true, contatoId: contato.id, callId: dados.call_id ?? null };
  } catch (e) {
    return await registrarFalha(contato.id, `erro_rede: ${String(e).slice(0, 150)}`);
  }
}

/**
 * Preenche todas as vagas livres de uma vez.
 * Usada ao iniciar a campanha e sempre que uma chamada termina.
 */
export async function preencherVagas(clienteId) {
  const disparos = [];
  // No máximo CONCORRENCIA_MAXIMA tentativas por execução, para não
  // estourar o tempo da função serverless.
  for (let i = 0; i < CONCORRENCIA_MAXIMA; i++) {
    const r = await processarProximoDaFila(clienteId);
    disparos.push(r);
    // Para quando não há vaga, ninguém liberado ou a fila acabou
    if (!r.disparou) break;
  }
  const emitidas = disparos.filter((d) => d.disparou).length;
  return { emitidas, concorrencia: CONCORRENCIA_MAXIMA, detalhes: disparos };
}

/**
 * Falha (não atendeu, caixa postal, erro, queda <= 13s):
 * +1 tentativa; volta para PENDENTE até a 7ª, quando vira ESGOTADO.
 */
export async function registrarFalha(contatoId, motivo) {
  const { rows } = await sql`
    UPDATE contatos SET
      tentativas    = tentativas + 1,
      status        = CASE WHEN tentativas + 1 >= ${LIMITE_TENTATIVAS} THEN 'ESGOTADO' ELSE 'PENDENTE' END,
      ultimo_motivo = ${motivo},
      call_id       = NULL,
      -- Espera crescente antes de tentar este número de novo:
      -- 1a falha 20min, 2a 40min, 3a 1h... enquanto isso a fila
      -- segue discando para OUTROS contatos.
      proxima_tentativa = NOW() + (${MINUTOS_ENTRE_TENTATIVAS} * (tentativas + 1)) * INTERVAL '1 minute',
      atualizado_em = NOW()
    WHERE id = ${contatoId}
    RETURNING status, tentativas, proxima_tentativa;
  `;
  return {
    disparou: false,
    falha: true,
    novoStatus: rows[0]?.status,
    tentativas: rows[0]?.tentativas,
    proximaTentativa: rows[0]?.proxima_tentativa,
  };
}

/** Sucesso: atendeu e conversou por mais de 13 segundos. */
export async function registrarSucesso(contatoId, motivo) {
  await sql`
    UPDATE contatos SET status = 'CONCLUIDA', ultimo_motivo = ${motivo}, atualizado_em = NOW()
    WHERE id = ${contatoId};
  `;
}

/** Pausa a campanha do cliente (usado quando o saldo acaba). */
export async function pausarCampanha(clienteId, motivo) {
  await sql`
    UPDATE contatos SET status = 'PAUSADA', ultimo_motivo = ${motivo}, atualizado_em = NOW()
    WHERE cliente_id = ${clienteId} AND status = 'PENDENTE';
  `;
}

/** Localiza o contato pela chamada (metadata.contato_id ou call_id). */
export async function acharContatoDaChamada(metadata, callId) {
  await garantirTabelas();
  const idMeta = metadata?.contato_id;
  if (idMeta) {
    const { rows } = await sql`SELECT * FROM contatos WHERE id = ${idMeta} LIMIT 1;`;
    if (rows.length) return rows[0];
  }
  if (callId) {
    const { rows } = await sql`SELECT * FROM contatos WHERE call_id = ${callId} LIMIT 1;`;
    if (rows.length) return rows[0];
  }
  return null;
}

/** Resumo da fila para a tela de acompanhamento. */
export async function resumoFila(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT status, COUNT(*)::int AS total FROM contatos
    WHERE cliente_id = ${clienteId} GROUP BY status;
  `;
  return rows;
}

/**
 * Últimos erros da fila — o que a Retell respondeu em cada tentativa.
 * É por aqui que se descobre por que uma ligação não completou.
 */
export async function ultimosMotivos(clienteId, limite = 10) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT nome, telefone, status, tentativas, ultimo_motivo, proxima_tentativa, atualizado_em
    FROM contatos
    WHERE cliente_id = ${clienteId} AND ultimo_motivo IS NOT NULL
    ORDER BY atualizado_em DESC LIMIT ${limite};
  `;
  return rows;
}
