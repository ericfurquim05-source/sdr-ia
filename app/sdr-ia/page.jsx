import ChamadasReais from "@/components/ChamadasReais";
import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Aba SDR IA — histórico REAL das ligações da tabela "ligacoes". */
export default async function SdrIa() {
  let ligacoes = [];
  try {
    const cliente = await clienteLogado();
    if (cliente) {
      await garantirTabelas();
      const { rows } = await sql`
        SELECT id, nome, telefone, duracao_ms::int AS duracao_ms, motivo, sucesso,
               recording_url, transcript, resumo, criado_em
        FROM ligacoes
        WHERE cliente_id = ${cliente.id}
        ORDER BY criado_em DESC
        LIMIT 100;
      `;
      ligacoes = rows.map((r) => ({ ...r, criado_em: r.criado_em.toISOString() }));
    }
  } catch {
    ligacoes = [];
  }

  return <ChamadasReais ligacoes={ligacoes} />;
}
