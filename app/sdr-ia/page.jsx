import ChamadasReais from "@/components/ChamadasReais";
import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { hojeSP, lerJanela } from "@/lib/estatisticas";

export const dynamic = "force-dynamic";

/*
 * Aba SDR IA — histórico REAL das ligações.
 * Aceita ?de=&ate= (mesmo formato do Dashboard) e ?ordem=
 *   duracao_desc → quem falou mais tempo primeiro (padrão útil)
 *   duracao_asc  → conversas mais curtas primeiro
 *   recentes / antigas → por data
 */
const ORDENS = ["duracao_desc", "duracao_asc", "recentes", "antigas"];

export default async function SdrIa({ searchParams }) {
  const hoje = hojeSP();
  // Padrão: últimos 30 dias, para não abrir a tela vazia
  const trintaDias = new Date(Date.now() - 29 * 86400000).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const { de, ate, horas } = lerJanela(searchParams, trintaDias, hoje);

  const ordem = ORDENS.includes(searchParams?.ordem) ? searchParams.ordem : "duracao_desc";

  let ligacoes = [];
  let totais = { total: 0, atendidas: 0, msTotal: 0 };

  try {
    const cliente = await clienteLogado();
    if (cliente) {
      await garantirTabelas();

      // Ordenação sem SQL dinâmico: o banco decide pelo valor validado acima
      const { rows } = await sql`
        SELECT id, nome, telefone, duracao_ms::int AS duracao_ms, motivo, sucesso,
               recording_url, transcript, resumo, criado_em
        FROM ligacoes
        WHERE cliente_id = ${cliente.id}
          AND (
            (${horas}::int IS NULL AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date)
            OR (${horas}::int IS NOT NULL AND criado_em > NOW() - (${horas}::int * INTERVAL '1 hour'))
          )
        ORDER BY
          CASE WHEN ${ordem} = 'duracao_desc' THEN duracao_ms END DESC,
          CASE WHEN ${ordem} = 'duracao_asc'  THEN duracao_ms END ASC,
          CASE WHEN ${ordem} = 'antigas'      THEN criado_em  END ASC,
          criado_em DESC
        LIMIT 200;
      `;
      ligacoes = rows.map((r) => ({ ...r, criado_em: r.criado_em.toISOString() }));

      const { rows: agg } = await sql`
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE sucesso)::int AS atendidas,
               COALESCE(SUM(duracao_ms), 0)::bigint AS ms_total
        FROM ligacoes
        WHERE cliente_id = ${cliente.id}
          AND (
            (${horas}::int IS NULL AND (criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN ${de}::date AND ${ate}::date)
            OR (${horas}::int IS NOT NULL AND criado_em > NOW() - (${horas}::int * INTERVAL '1 hour'))
          );
      `;
      totais = {
        total: agg[0].total,
        atendidas: agg[0].atendidas,
        msTotal: Number(agg[0].ms_total),
      };
    }
  } catch {
    ligacoes = [];
  }

  return (
    <ChamadasReais
      ligacoes={ligacoes}
      de={de}
      ate={ate}
      horas={horas}
      ordem={ordem}
      totais={totais}
    />
  );
}
