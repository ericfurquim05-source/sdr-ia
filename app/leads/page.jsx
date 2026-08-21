import QuadroLeads from "@/components/QuadroLeads";
import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { devolverLeadsParados } from "@/lib/equipe";

export const dynamic = "force-dynamic";

/*
 * Quadro de contatos da equipe.
 * Traz apenas as conversas que valem follow-up: atendidas e com
 * mais de 1min10 — as demais não geram trabalho para ninguém.
 */
export default async function Leads() {
  let leads = [];
  let meuId = null;

  try {
    const cliente = await clienteLogado();
    if (cliente) {
      meuId = cliente.id;
      await garantirTabelas();
      await devolverLeadsParados(cliente.id);

      const { rows } = await sql`
        SELECT id, nome, telefone, duracao_ms::int AS duracao_ms, transcript, resumo,
               assumido_por, desfecho_equipe, criado_em
        FROM ligacoes
        WHERE cliente_id = ${cliente.id}
          AND sucesso = TRUE
          AND duracao_ms >= 70000
        ORDER BY criado_em DESC
        LIMIT 200;
      `;
      leads = rows.map((r) => ({ ...r, criado_em: r.criado_em.toISOString() }));
    }
  } catch {
    leads = [];
  }

  return <QuadroLeads leads={leads} meuId={meuId} />;
}
