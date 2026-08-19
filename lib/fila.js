import { garantirTabelas, sql } from "@/lib/db";
import { montarNumeroDestino } from "@/lib/retell";

/*
 * ============================================================
 * WORKER DA FILA DE LIGAÇÕES
 * ============================================================
 * COMO FUNCIONA
 *   liga → aguarda encerrar (webhook) → classifica o desfecho
 *     ├─ atendeu e falou > 13s → CONCLUIDA
 *     └─ não atendeu / caixa postal / erro / <= 13s
 *          → +1 tentativa e AGENDA a próxima (espera crescente);
 *            na 7ª falha vira ESGOTADO e não liga mais.
 *
 * Enquanto um número espera sua vez, a fila segue com OUTROS
 * contatos — nunca duas ligações seguidas para o mesmo número.
 *
 * CONCORRÊNCIA: até CONCORRENCIA_MAXIMA chamadas simultâneas por
 * cliente. Cada chamada que termina libera a vaga e puxa a próxima.
 *
 * FOR UPDATE SKIP LOCKED impede que duas execuções simultâneas
 * peguem o mesmo contato.
 */

const LIMITE_TENTATIVAS = 7;

// Espera entre tentativas do MESMO número, crescente:
// 1ª falha 20min, 2ª 40min, 3ª 1h... (padrão 20; ajustável na Vercel)
const MINUTOS_ENTRE_TENTATIVAS = Number(process.env.MINUTOS_ENTRE_TENTATIVAS || 20);

// Ligações simultâneas por cliente (Retell permite até 10 no plano atual)
const CONCORRENCIA_MAXIMA = Math.max(Number(process.env.CONCORRENCIA_MAXIMA || 3), 1);

/*
 * JANELA DE DISCAGEM — HORÁRIO COMERCIAL
 * Fora da janela, nada é discado: a fila fica aguardando e o
 * cron/próxima ação retoma no dia seguinte. Horário de Brasília.
 * Ajustável pelas variáveis HORA_INICIO_LIGACOES e HORA_FIM_LIGACOES.
 */
const HORA_INICIO = Number(process.env.HORA_INICIO_LIGACOES ?? 8);  // liga a partir das 8h
const HORA_FIM = Number(process.env.HORA_FIM_LIGACOES ?? 21);       // última ligação antes das 21h

/** Hora atual em Brasília (o servidor da Vercel roda em UTC). */
function horaBrasilia() {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );
}

/** true se agora está dentro da janela permitida de discagem. */
export function dentroDaJanela() {
  const h = horaBrasilia();
  return h >= HORA_INICIO && h < HORA_FIM;
}

/** Busca o agente do cliente; cai no agente global se não houver. */
async function agentIdDoCliente(clienteId, tipo) {
  const { rows } = await sql`
    SELECT retell_agent_id, from_number FROM agentes
    WHERE cliente_id = ${clienteId} AND tipo = ${tipo} LIMIT 1;
  `;
  if (rows.length) {
    return {
      agentId: rows[0].retell_agent_id,
      fromNumber: rows[0].from_number || process.env.RETELL_FROM_NUMBER,
    };
  }
  return {
    agentId: tipo === "quente" ? process.env.RETELL_AGENT_QUENTE_ID : process.env.RETELL_AGENT_FRIO_ID,
    fromNumber: process.env.RETELL_FROM_NUMBER,
  };
}

/** Tenta ocupar UMA vaga: pega o próximo liberado e dispara na Retell. */
export async function processarProximoDaFila(clienteId) {
  // Fora do horário permitido (padrão 8h–21h de Brasília), não disca.
  if (!dentroDaJanela()) {
    return { disparou: false, motivo: "fora_do_horario", janela: `${HORA_INICIO}h às ${HORA_FIM}h` };
  }

  await garantirTabelas();

  // Há vaga? Nunca ultrapassa o limite de chamadas simultâneas.
  const { rows: ativas } = await sql`
    SELECT COUNT(*)::int AS total FROM contatos
    WHERE cliente_id = ${clienteId} AND status = 'EM_LIGACAO';
  `;
  if ((ativas[0]?.total ?? 0) >= CONCORRENCIA_MAXIMA) {
    return { disparou: false, motivo: "concorrencia_cheia", ativas: ativas[0].total };
  }

  // Próximo da fila: menos tentativas primeiro; respeita a espera do redial
  const { rows } = await sql`
    UPDATE contatos SET status = 'EM_LIGACAO', atualizado_em = NOW()
    WHERE id = (
      SELECT id FROM contatos
      WHERE cliente_id = ${clienteId}
        AND status = 'PENDENTE'
        AND tentativas < ${LIMITE_TENTATIVAS}
        AND proxima_tentativa <= NOW()
      ORDER BY tentativas ASC, proxima_tentativa ASC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, nome, telefone, tentativas, agente;
  `;

  if (rows.length === 0) {
    // Ninguém liberado agora: fila vazia ou todos aguardando o intervalo
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
        // "Keep raw input" da API: sem isso a Retell normaliza para E.164
        // e rejeita números com prefixo de tronco SIP (968655 + DDD + nº).
        ignore_e164_validation: true,
        retell_llm_dynamic_variables: { nome: contato.nome || "" },
        // Volta no webhook: é como reencontramos o contato e o cliente
        metadata: { contato_id: contato.id, cliente_id: clienteId },
      }),
    });

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 250);
      // Guarda o de/para junto do erro: quase todo problema é formato de número
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
  for (let i = 0; i < CONCORRENCIA_MAXIMA; i++) {
    const r = await processarProximoDaFila(clienteId);
    disparos.push(r);
    if (!r.disparou) break; // sem vaga, todos em espera ou fila vazia
  }
  const emitidas = disparos.filter((d) => d.disparou).length;
  return { emitidas, concorrencia: CONCORRENCIA_MAXIMA, detalhes: disparos };
}

/**
 * Falha (não atendeu, caixa postal, erro, queda <= 13s):
 * +1 tentativa e espera crescente; na 7ª falha vira ESGOTADO.
 */
export async function registrarFalha(contatoId, motivo) {
  const { rows } = await sql`
    UPDATE contatos SET
      tentativas    = tentativas + 1,
      status        = CASE WHEN tentativas + 1 >= ${LIMITE_TENTATIVAS} THEN 'ESGOTADO' ELSE 'PENDENTE' END,
      ultimo_motivo = ${motivo},
      call_id       = NULL,
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

/** Pausa a campanha do cliente (saldo esgotado). Volta pelo /reiniciar. */
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

/** Resumo da fila para acompanhamento. */
export async function resumoFila(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT status, COUNT(*)::int AS total FROM contatos
    WHERE cliente_id = ${clienteId} GROUP BY status;
  `;
  return rows;
}

/** Últimos retornos da Retell — o diagnóstico de cada tentativa. */
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
