import CalendarioGrade from "@/components/CalendarioGrade";
import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/*
 * Calendário — eventos REAIS da tabela "eventos".
 * Reuniões marcadas pela IA entram sozinhas via webhook call_analyzed
 * (com os campos de Post-Call Analysis configurados no agente da Retell).
 */
export default async function Calendario() {
  let eventos = [];
  try {
    const cliente = await clienteLogado();
    if (cliente) {
      await garantirTabelas();
      const { rows } = await sql`
        SELECT id, titulo, origem, telefone,
               inicio AT TIME ZONE 'America/Sao_Paulo' AS inicio_local
        FROM eventos
        WHERE cliente_id = ${cliente.id}
          AND inicio > NOW() - INTERVAL '60 days'
        ORDER BY inicio;
      `;
      eventos = rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        origem: r.origem,
        telefone: r.telefone,
        inicio: new Date(r.inicio_local).toISOString(),
      }));
    }
  } catch {
    eventos = [];
  }

  return <CalendarioGrade eventos={eventos} />;
}
