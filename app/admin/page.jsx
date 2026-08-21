import AdminPainel from "@/components/AdminPainel";
import { clienteLogado, ehAdmin } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Painel de suporte: só o ADMIN_EMAIL enxerga. */
export default async function Admin() {
  let clientes = [];
  let autorizado = false;

  try {
    const cliente = await clienteLogado();
    autorizado = ehAdmin(cliente);

    if (autorizado) {
      await garantirTabelas();
      const { rows } = await sql`
        SELECT
          c.id, c.nome, c.empresa, c.email, c.ativo,
          c.preco_minuto::float AS preco_minuto,
          c.criado_em,
          COALESCE((SELECT SUM(valor) FROM lancamentos l WHERE l.cliente_id = c.id), 0)::float AS saldo,
          (SELECT COUNT(*) FROM ligacoes lg WHERE lg.cliente_id = c.id)::int AS ligacoes,
          (SELECT COUNT(*) FROM contatos ct WHERE ct.cliente_id = c.id AND ct.status = 'PENDENTE')::int AS na_fila,
          (SELECT COUNT(*) FROM eventos ev WHERE ev.cliente_id = c.id)::int AS reunioes
        FROM clientes c
        ORDER BY c.criado_em DESC;
      `;
      clientes = rows.map((r) => ({ ...r, criado_em: r.criado_em.toISOString() }));
    }
  } catch {
    clientes = [];
  }

  if (!autorizado) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold text-white">Acesso restrito</p>
        <p className="mt-1 text-sm text-slate-500">
          Esta área é do administrador. Configure ADMIN_EMAIL na Vercel com o seu e-mail.
        </p>
      </div>
    );
  }

  return <AdminPainel clientes={clientes} />;
}
