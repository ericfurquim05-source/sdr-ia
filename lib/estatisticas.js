import { garantirTabelas, sql } from "@/lib/db";

/*
 * ============================================================
 * ESTATÍSTICAS DO DASHBOARD — DADOS REAIS POR PERÍODO
 * ============================================================
 * Todas as funções aceitam um intervalo {de, ate} (YYYY-MM-DD,
 * horário de Brasília) vindo do filtro do Dashboard.
 */

const TZ = "America/Sao_Paulo";

/** Hoje em Brasília no formato YYYY-MM-DD. */
export function hojeSP() {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Garante uma data válida ou devolve o padrão. */
export function dataValida(valor, padrao) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || "")) ? valor : padrao;
}

/** Traduz o disconnection_reason da Retell para um rótulo humano. */
export function rotuloDesfecho(motivo) {
  const m = String(motivo || "").toLowerCase();
  if (/user_hangup|agent_hangup|call_transfer|successful/.test(m)) return "Atendida";
  if (/voicemail|machine_detected/.test(m)) return "Caixa postal";
  if (/dial_no_answer/.test(m)) return "Não atendida";
  if (/dial_busy/.test(m)) return "Ocupado";
  if (/invalid_destination|telephony|error|http/.test(m)) return "Erro de operadora";
  return "Outros";
}

/**
 * KPIs do período: volume, atendimento, custo, RESULTADO.
 * As métricas de resultado (reuniões, custo por reunião, conversão)
 * são o que de fato mede se a campanha está dando retorno.
 */
export async function kpisDoPeriodo(clienteId, de, ate) {
  await garantirTabelas();

  const { rows: lig } = await sql`
    SELECT
      COUNT(*)::int                                            AS total,
      COUNT(*) FILTER (WHERE sucesso)::int                     AS atendidas,
      COUNT(*) FILTER (WHERE NOT sucesso)::int                 AS nao_atendidas,
      COALESCE(SUM(custo), 0)::float                           AS custo,
      COALESCE(SUM(duracao_ms) FILTER (WHERE sucesso), 0)::bigint AS ms_falados,
      COUNT(DISTINCT telefone)::int                            AS contatos_unicos
    FROM ligacoes
    WHERE cliente_id = ${clienteId}
      AND (criado_em AT TIME ZONE ${TZ})::date BETWEEN ${de}::date AND ${ate}::date;
  `;

  // RESULTADO: reuniões que a IA conquistou no período
  const { rows: reun } = await sql`
    SELECT COUNT(*)::int AS reunioes FROM eventos
    WHERE cliente_id = ${clienteId} AND origem = 'ia'
      AND (criado_em AT TIME ZONE ${TZ})::date BETWEEN ${de}::date AND ${ate}::date;
  `;

  // Follow-ups de WhatsApp disparados no período
  const { rows: wa } = await sql`
    SELECT COUNT(*)::int AS whatsapps FROM mensagens_wa
    WHERE cliente_id = ${clienteId} AND direcao = 'out'
      AND (criado_em AT TIME ZONE ${TZ})::date BETWEEN ${de}::date AND ${ate}::date;
  `;

  // Fila é sempre o retrato de AGORA (não depende do período)
  const { rows: fila } = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'PENDENTE')::int   AS pendentes,
      COUNT(*) FILTER (WHERE status = 'EM_LIGACAO')::int AS em_ligacao,
      COUNT(*) FILTER (WHERE status = 'CONCLUIDA')::int  AS concluidas,
      COUNT(*) FILTER (WHERE status = 'ESGOTADO')::int   AS esgotados
    FROM contatos WHERE cliente_id = ${clienteId};
  `;

  const k = lig[0];
  const reunioes = reun[0].reunioes;
  const atendidas = k.atendidas;

  return {
    ...k,
    minutosFalados: Math.round(Number(k.ms_falados) / 60000),
    duracaoMediaSeg: atendidas ? Math.round(Number(k.ms_falados) / 1000 / atendidas) : 0,
    taxaAtendimento: k.total ? Math.round((atendidas / k.total) * 100) : 0,
    reunioes,
    conversao: atendidas ? Math.round((reunioes / atendidas) * 100) : 0,
    custoPorReuniao: reunioes ? Math.round((k.custo / reunioes) * 100) / 100 : null,
    whatsapps: wa[0].whatsapps,
    fila: fila[0],
  };
}

/** Série diária do período para o gráfico. */
export async function seriePorDia(clienteId, de, ate) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT
      (criado_em AT TIME ZONE ${TZ})::date AS dia,
      COUNT(*)::int                        AS total,
      COUNT(*) FILTER (WHERE sucesso)::int AS atendidas
    FROM ligacoes
    WHERE cliente_id = ${clienteId}
      AND (criado_em AT TIME ZONE ${TZ})::date BETWEEN ${de}::date AND ${ate}::date
    GROUP BY 1 ORDER BY 1;
  `;

  const porDia = new Map(rows.map((r) => [String(r.dia).slice(0, 10), r]));
  const serie = [];
  const inicio = new Date(de + "T12:00:00Z");
  const fim = new Date(ate + "T12:00:00Z");
  // Protege o gráfico: no máximo 92 pontos
  for (let d = new Date(inicio), i = 0; d <= fim && i < 92; d.setUTCDate(d.getUTCDate() + 1), i++) {
    const chave = d.toISOString().slice(0, 10);
    const r = porDia.get(chave);
    serie.push({
      dia: `${chave.slice(8, 10)}/${chave.slice(5, 7)}`,
      ligacoes: r?.total ?? 0,
      atendidas: r?.atendidas ?? 0,
    });
  }
  return serie;
}

/** Desfechos do período agrupados por rótulo humano. */
export async function desfechosDoPeriodo(clienteId, de, ate) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT motivo, COUNT(*)::int AS total FROM ligacoes
    WHERE cliente_id = ${clienteId}
      AND (criado_em AT TIME ZONE ${TZ})::date BETWEEN ${de}::date AND ${ate}::date
    GROUP BY motivo;
  `;

  const grupos = new Map();
  for (const r of rows) {
    const rotulo = rotuloDesfecho(r.motivo);
    grupos.set(rotulo, (grupos.get(rotulo) ?? 0) + r.total);
  }

  const cores = {
    "Atendida": "#34D399",
    "Caixa postal": "#8B5CF6",
    "Não atendida": "#64748B",
    "Ocupado": "#F59E0B",
    "Erro de operadora": "#F43F5E",
    "Outros": "#475569",
  };

  return [...grupos.entries()]
    .map(([rotulo, total]) => ({ rotulo, total, cor: cores[rotulo] ?? "#475569" }))
    .sort((a, b) => b.total - a.total);
}
