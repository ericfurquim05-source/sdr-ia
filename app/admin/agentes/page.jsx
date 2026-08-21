import ConstrutorAgente from "@/components/ConstrutorAgente";
import { clienteLogado, ehAdmin } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Construtor de agentes — área do console, não do cliente. */
export default async function AdminAgentes() {
  let clientes = [];
  let agentes = [];
  let autorizado = false;

  try {
    const cliente = await clienteLogado();
    autorizado = ehAdmin(cliente);

    if (autorizado) {
      await garantirTabelas();
      const c = await sql`
        SELECT id, nome, empresa, email FROM clientes WHERE ativo = TRUE ORDER BY empresa, nome;
      `;
      const a = await sql`SELECT cliente_id, tipo, nome, prompt, voz FROM agentes;`;
      clientes = c.rows;
      agentes = a.rows;
    }
  } catch {
    clientes = [];
  }

  if (!autorizado) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold text-white">Acesso restrito</p>
        <p className="mt-1 text-sm text-slate-500">
          Configure ADMIN_EMAIL na Vercel com o seu e-mail de login.
        </p>
      </div>
    );
  }

  return <ConstrutorAgente clientes={clientes} agentes={agentes} />;
}
