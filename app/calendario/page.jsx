import CalendarioGrade from "@/components/CalendarioGrade";
import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { horariosLivres } from "@/lib/agenda";

export const dynamic = "force-dynamic";

/*
 * Calendário — eventos REAIS da tabela "eventos".
 * Reuniões marcadas pela IA entram sozinhas via webhook call_analyzed
 * (com os campos de Post-Call Analysis configurados no agente da Retell).
 */
export default async function Calendario() {
  let eventos = [];
  let googleConectado = false;
  let livres = [];
  try {
    const cliente = await clienteLogado();
    if (cliente) {
      googleConectado = Boolean(cliente.google_ics_url);
      await garantirTabelas();
      const { rows } = await sql`
        SELECT id, titulo, origem, telefone, inicio
        FROM eventos
        WHERE cliente_id = ${cliente.id}
          AND inicio > NOW() - INTERVAL '60 days'
        ORDER BY inicio;
      `;
      // Os mesmos horários que a Lara enxerga durante a ligação
      livres = (await horariosLivres(cliente.id, 40)).horarios_livres;

      eventos = rows.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        origem: r.origem,
        telefone: r.telefone,
        // timestamptz cru: o instante correto. A conversão para o
        // horário de Brasília acontece só na exibição.
        inicio: r.inicio.toISOString(),
      }));
    }
  } catch {
    eventos = [];
  }

  return (
    <CalendarioGrade eventos={eventos} livres={livres} googleConectado={googleConectado} />
  );
}
