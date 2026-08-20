import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/*
 * PLANILHA DE MÉTRICAS — espelho fiel do Dashboard.
 * GET /api/relatorio/ligacoes → baixa um CSV (abre no Excel) com
 * todas as ligações do cliente: data, contato, duração, desfecho,
 * sucesso, custo e resumo da IA.
 */
export async function GET() {
  const cliente = await clienteLogado();
  if (!cliente) return new Response("Faça login.", { status: 401 });

  await garantirTabelas();
  const { rows } = await sql`
    SELECT criado_em AT TIME ZONE 'America/Sao_Paulo' AS data_hora,
           nome, telefone, agente,
           ROUND(duracao_ms / 1000.0)::int AS duracao_segundos,
           motivo, sucesso, custo::float AS custo, COALESCE(resumo, '') AS resumo
    FROM ligacoes WHERE cliente_id = ${cliente.id}
    ORDER BY criado_em DESC LIMIT 5000;
  `;

  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = [
    ["data_hora", "nome", "telefone", "agente", "duracao_segundos", "desfecho", "atendida", "custo_reais", "resumo_ia"].join(";"),
    ...rows.map((r) =>
      [
        new Date(r.data_hora).toLocaleString("pt-BR"),
        esc(r.nome), esc(r.telefone), r.agente, r.duracao_segundos,
        esc(r.motivo), r.sucesso ? "SIM" : "NAO",
        String(r.custo).replace(".", ","), esc(r.resumo),
      ].join(";")
    ),
  ];

  // \uFEFF = BOM: faz o Excel abrir acentos corretamente
  return new Response("\uFEFF" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ligacoes-sdr-ia.csv"`,
    },
  });
}
