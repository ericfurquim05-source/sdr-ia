import { garantirTabelas, sql } from "@/lib/db";

/*
 * ============================================================
 * ESTATÍSTICAS DO DASHBOARD — DADOS REAIS
 * ============================================================
 * Tudo aqui sai da tabela "ligacoes" (uma linha por chamada) e
 * da fila "contatos". Datas em horário de Brasília.
 */

const TZ = "America/Sao_Paulo";

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

/** KPIs do dia: total, atendidas, não atendidas, custo e fila agora. */
export async function kpisDeHoje(clienteId) {
  await garantirTabelas();

  const { rows: hoje } = await sql`
    SELECT
      COUNT(*)::int                                    AS total,
      COUNT(*) FILTER (WHERE sucesso)::int             AS atendidas,
      COUNT(*) FILTER (WHERE NOT sucesso)::int         AS nao_atendidas,
      COALESCE(SUM(custo), 0)::float                   AS custo,
      COALESCE(SUM(duracao_ms) FILTER (WHERE sucesso), 0)::bigint AS ms_falados
    FROM ligacoes
    WHERE cliente_id = ${clienteId}
      AND (criado_em AT TIME ZONE ${TZ})::date = (NOW() AT TIME ZONE ${TZ})::date;
  `;

  const { rows: fila } = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'PENDENTE')::int   AS pendentes,
      COUNT(*) FILTER (WHERE status = 'EM_LIGACAO')::int AS em_ligacao,
      COUNT(*) FILTER (WHERE status = 'CONCLUIDA')::int  AS concluidas,
      COUNT(*) FILTER (WHERE status = 'ESGOTADO')::int   AS esgotados
    FROM contatos WHERE cliente_id = ${clienteId};
  `;

  return {
    ...hoje[0],
    minutosFalados: Math.round(Number(hoje[0].ms_falados) / 60000),
    fila: fila[0],
  };
}

/** Série dos últimos 7 dias: ligações, atendidas e % de atendimento. */
export async function serieUltimos7Dias(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT
      (criado_em AT TIME ZONE ${TZ})::date               AS dia,
      COUNT(*)::int                                      AS total,
      COUNT(*) FILTER (WHERE sucesso)::int               AS atendidas
    FROM ligacoes
    WHERE cliente_id = ${clienteId}
      AND criado_em > NOW() - INTERVAL '7 days'
    GROUP BY 1 ORDER BY 1;
  `;

  // Preenche os dias sem ligação com zero, para o gráfico não "pular"
  const porDia = new Map(rows.map((r) => [String(r.dia).slice(0, 10), r]));
  const serie = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const chaveISO = d.toLocaleDateString("en-CA", { timeZone: TZ }); // aaaa-mm-dd
    const rotulo = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
    const r = porDia.get(chaveISO);
    const total = r?.total ?? 0;
    const atendidas = r?.atendidas ?? 0;
    serie.push({
      dia: rotulo,
      ligacoes: total,
      atendidas,
      atendimento: total ? Math.round((atendidas / total) * 100) : 0,
    });
  }
  return serie;
}

/** Desfechos de hoje agrupados por rótulo humano. */
export async function desfechosDeHoje(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT motivo, COUNT(*)::int AS total FROM ligacoes
    WHERE cliente_id = ${clienteId}
      AND (criado_em AT TIME ZONE ${TZ})::date = (NOW() AT TIME ZONE ${TZ})::date
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
