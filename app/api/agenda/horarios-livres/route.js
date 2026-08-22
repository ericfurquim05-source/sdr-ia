import { NextResponse } from "next/server";
import { segredoAgendaConfere } from "@/lib/seguranca";
import { horariosLivres, reuniaoJaMarcada } from "@/lib/agenda";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/*
 * A Retell chama esta rota DURANTE a ligação (Custom Function
 * "consultar_horarios") para oferecer só horários realmente vagos.
 * A regra fica em lib/agenda.js, compartilhada com o WhatsApp.
 */
export async function POST(request) {
  try {
    // Só a custom function da Retell (que envia o cabeçalho
    // x-agenda-segredo) pode consultar e marcar. Sem isso,
    // qualquer um lotaria a agenda com reunião falsa.
    if (!segredoAgendaConfere(request)) {
      return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
    }

    const corpo = await request.json().catch(() => ({}));
    const clienteId = corpo?.call?.metadata?.cliente_id ?? corpo?.args?.cliente_id ?? null;
    if (!clienteId) {
      return NextResponse.json({ erro: "cliente_nao_identificado" }, { status: 400 });
    }

    const resultado = await horariosLivres(clienteId);

    // Este lead já tem reunião? Avisa a IA para não "corrigir" a
    // própria marcação ao ver o horário ocupado na consulta.
    let jaMarcada = null;
    const contatoId = corpo?.call?.metadata?.contato_id ?? null;
    if (contatoId) {
      const { rows } = await sql`SELECT telefone FROM contatos WHERE id = ${contatoId} LIMIT 1;`;
      if (rows[0]?.telefone) {
        jaMarcada = await reuniaoJaMarcada(clienteId, rows[0].telefone);
      }
    }

    return NextResponse.json({
      ...resultado,
      ...(jaMarcada
        ? {
            reuniao_ja_marcada: jaMarcada,
            instrucao:
              "ATENÇÃO: este lead JÁ TEM reunião marcada (acima). Não ofereça novos horários — apenas confirme a reunião existente. Só use os horários livres se o lead PEDIR para remarcar.",
          }
        : {}),
      regras: "Atendimento de segunda a sábado, das 08:00 às 21:00.",
    });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
