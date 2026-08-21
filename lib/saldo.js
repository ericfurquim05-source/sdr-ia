import { garantirTabelas, sql } from "@/lib/db";

/*
 * ============================================================
 * MOTOR DE COBRANÇA — SALDO PRÉ-PAGO
 * ============================================================
 * REGRAS DEFINIDAS COM O CLIENTE:
 *  1. Ligação: cobrança POR SEGUNDO, proporcional.
 *     Ex.: 90s a R$ 1,50/min = 90/60 × 1,50 = R$ 2,25
 *  2. COBRA TODO SEGUNDO CONECTADO, inclusive chamadas curtas e
 *     caixa postal — porque a operadora cobra esses segundos de nós.
 *     Só não cobra o que nunca conectou (duração zero: não atendida,
 *     ocupado, erro de operadora).
 *     ATENÇÃO: isso é diferente da régua de SUCESSO (>13s), que
 *     decide se o contato vira CONCLUIDA ou volta para a fila.
 *  3. WhatsApp: R$ 0,50 por JANELA de 24h aberta. Mensagens
 *     dentro da mesma janela não geram nova cobrança.
 *  4. Saldo insuficiente BLOQUEIA a campanha na entrada — o
 *     cliente é avisado antes de a lista ser aceita.
 *
 * O saldo é sempre a SOMA dos lançamentos, nunca um campo solto.
 */

// Segundos mínimos para gerar cobrança. Padrão 0 = cobra tudo que
// conectou. Ajustável pela variável SEGUNDOS_MINIMOS_COBRANCA.
const SEGUNDOS_MINIMOS_COBRANCA = Number(process.env.SEGUNDOS_MINIMOS_COBRANCA || 0);

// Estimativa de duração média usada só para o bloqueio prévio
const MINUTOS_ESTIMADOS_POR_LIGACAO = Number(process.env.MINUTOS_ESTIMADOS_POR_LIGACAO || 1.5);

/** Saldo atual do cliente, em reais. */
export async function saldoAtual(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT COALESCE(SUM(valor), 0)::float AS saldo
    FROM lancamentos WHERE cliente_id = ${clienteId};
  `;
  return Number(rows[0]?.saldo ?? 0);
}

/** Registra um lançamento. Valor positivo credita, negativo debita. */
export async function lancar({ clienteId, tipo, valor, descricao = "", referencia = null }) {
  await garantirTabelas();
  // ON CONFLICT: se o webhook repetir o mesmo call_id, não cobra de novo
  const { rows } = await sql`
    INSERT INTO lancamentos (cliente_id, tipo, valor, descricao, referencia)
    VALUES (${clienteId}, ${tipo}, ${valor}, ${descricao}, ${referencia})
    ON CONFLICT (tipo, referencia) WHERE referencia IS NOT NULL DO NOTHING
    RETURNING id;
  `;
  return rows[0]?.id ?? null; // null = já havia sido cobrado antes
}

/**
 * Cobra uma ligação encerrada, proporcional aos segundos falados.
 * Retorna { cobrado, valor, segundos }.
 */
export async function cobrarLigacao({ clienteId, precoMinuto, duracaoMs, callId }) {
  const segundos = (duracaoMs || 0) / 1000;

  // Só não cobra o que nunca conectou (0s) ou ficou abaixo do mínimo
  if (segundos <= SEGUNDOS_MINIMOS_COBRANCA) {
    return { cobrado: false, valor: 0, segundos: Math.round(segundos) };
  }

  // Proporcional ao segundo, arredondado ao centavo
  const valor = Math.round((segundos / 60) * Number(precoMinuto) * 100) / 100;

  const id = await lancar({
    clienteId,
    tipo: "ligacao",
    valor: -valor,
    descricao: `Ligação de ${Math.round(segundos)}s`,
    referencia: callId,
  });

  return { cobrado: id !== null, valor, segundos: Math.round(segundos) };
}

/**
 * Cobra R$ 0,50 por janela nova de WhatsApp (24h).
 * Se já existe janela aberta para o telefone, não cobra.
 */
export async function cobrarConversaWhatsapp({ clienteId, precoConversa, telefone }) {
  await garantirTabelas();

  const { rows: abertas } = await sql`
    SELECT id FROM conversas
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone} AND janela_fim > NOW()
    LIMIT 1;
  `;
  if (abertas.length > 0) {
    return { cobrado: false, valor: 0, motivo: "janela_ja_aberta" };
  }

  const { rows: nova } = await sql`
    INSERT INTO conversas (cliente_id, telefone, janela_fim, cobrada)
    VALUES (${clienteId}, ${telefone}, NOW() + INTERVAL '24 hours', TRUE)
    RETURNING id;
  `;

  const valor = Number(precoConversa);
  await lancar({
    clienteId,
    tipo: "whatsapp",
    valor: -valor,
    descricao: `Conversa de WhatsApp (janela 24h) — ${telefone}`,
    referencia: `conversa_${nova[0].id}`,
  });

  return { cobrado: true, valor, conversaId: nova[0].id };
}

/*
 * RÉGUA DE BÔNUS DA RECARGA — quanto maior o saldo, menor o custo.
 * Mínimo de recarga: R$ 200.
 *   Abaixo de R$ 3.000 → sem bônus (preço cheio)
 *   R$ 3.000 ou mais   → +7% (bônus exclusivo dos tickets altos)
 * Para mudar a régua, edite só esta tabela.
 */
export const RECARGA_MINIMA = 200;
const FAIXAS_BONUS = [
  { min: 3000, percentual: 7 },
  { min: 0, percentual: 0 },
];

export function faixaBonus(valor) {
  const v = Number(valor) || 0;
  const faixa = FAIXAS_BONUS.find((f) => v >= f.min) ?? { percentual: 0 };
  const bonus = Math.round(v * (faixa.percentual / 100) * 100) / 100;
  return { percentual: faixa.percentual, bonus, totalCreditado: Math.round((v + bonus) * 100) / 100 };
}

/** Credita uma recarga (usado depois pelo gateway de pagamento). */
export async function creditarRecarga({ clienteId, valor, descricao, referencia }) {
  const id = await lancar({ clienteId, tipo: "recarga", valor: Math.abs(valor), descricao, referencia });
  // Recarregou? A campanha que parou por falta de saldo volta sozinha.
  if (id) await reativarCampanhaPausada(clienteId);
  return id;
}

/**
 * Devolve à fila os contatos pausados por saldo esgotado.
 * Sem isso o cliente recarrega e a campanha fica parada, sem
 * ninguém entender o motivo.
 */
export async function reativarCampanhaPausada(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    UPDATE contatos
    SET status = 'PENDENTE', proxima_tentativa = NOW(), atualizado_em = NOW()
    WHERE cliente_id = ${clienteId} AND status = 'PAUSADA'
    RETURNING id;
  `;
  return rows.length;
}

/**
 * Checagem ANTES de aceitar a lista: o saldo cobre a campanha?
 * Usa uma duração média estimada por ligação.
 */
export async function podeIniciarCampanha({ clienteId, precoMinuto, totalContatos }) {
  const saldo = await saldoAtual(clienteId);
  const custoEstimado =
    Math.round(totalContatos * MINUTOS_ESTIMADOS_POR_LIGACAO * Number(precoMinuto) * 100) / 100;

  return {
    liberado: saldo >= custoEstimado,
    saldo,
    custoEstimado,
    faltam: Math.max(Math.round((custoEstimado - saldo) * 100) / 100, 0),
  };
}

/** Extrato para a tela da Carteira. */
export async function extrato(clienteId, limite = 50) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT id, tipo, valor::float AS valor, descricao, criado_em
    FROM lancamentos WHERE cliente_id = ${clienteId}
    ORDER BY criado_em DESC LIMIT ${limite};
  `;
  return rows;
}
