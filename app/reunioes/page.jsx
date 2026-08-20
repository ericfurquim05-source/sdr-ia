import ReunioesLista from "@/components/ReunioesLista";
import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/*
 * REUNIÕES AGENDADAS
 * Lista as reuniões e traz junto a ligação que gerou cada uma —
 * gravação, resumo e transcrição — para o Eric chegar preparado.
 * O vínculo é pelo call_id; se faltar, cai no telefone.
 */
export default async function Reunioes() {
  let reunioes = [];

  try {
    const cliente = await clienteLogado();
    if (cliente) {
      await garantirTabelas();
      const { rows } = await sql`
        SELECT
          e.id,
          e.titulo,
          e.origem,
          e.telefone,
          e.inicio AT TIME ZONE 'America/Sao_Paulo' AS inicio_local,
          e.criado_em AT TIME ZONE 'America/Sao_Paulo' AS criado_local,
          l.id            AS ligacao_id,
          l.nome          AS lead_nome,
          l.duracao_ms::int AS duracao_ms,
          l.recording_url,
          l.transcript,
          l.resumo,
          l.criado_em AT TIME ZONE 'America/Sao_Paulo' AS ligacao_em
        FROM eventos e
        LEFT JOIN LATERAL (
          SELECT * FROM ligacoes lg
          WHERE lg.cliente_id = e.cliente_id
            AND (lg.call_id = e.call_id OR lg.telefone = e.telefone)
          ORDER BY (lg.call_id = e.call_id) DESC, lg.criado_em DESC
          LIMIT 1
        ) l ON TRUE
        WHERE e.cliente_id = ${cliente.id}
        ORDER BY e.inicio DESC
        LIMIT 200;
      `;

      reunioes = rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        origem: r.origem,
        telefone: r.telefone,
        inicio: new Date(r.inicio_local).toISOString(),
        criadoEm: new Date(r.criado_local).toISOString(),
        ligacao: r.ligacao_id
          ? {
              nome: r.lead_nome,
              duracaoMs: r.duracao_ms,
              recordingUrl: r.recording_url,
              transcript: r.transcript,
              resumo: r.resumo,
              quando: new Date(r.ligacao_em).toISOString(),
            }
          : null,
      }));
    }
  } catch {
    reunioes = [];
  }

  return <ReunioesLista reunioes={reunioes} />;
}
