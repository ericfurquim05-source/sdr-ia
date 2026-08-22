import { NextResponse } from "next/server";
import { exigirCliente } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { gerarBriefing } from "@/lib/briefing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * Gera (ou refaz) o resumo pré-reunião de um evento específico.
 * Usado pelo botão "Preparar reunião" na página Reuniões — cobre
 * as reuniões marcadas por telefone, que nascem sem resumo, e
 * permite atualizar depois que a conversa do WhatsApp evoluiu.
 */
export async function POST(request) {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  try {
    const { eventoId } = await request.json().catch(() => ({}));
    if (!eventoId) {
      return NextResponse.json({ erro: "Reunião não informada." }, { status: 400 });
    }

    await garantirTabelas();

    // O evento precisa ser DESTE cliente — nunca gerar para os outros
    const { rows } = await sql`
      SELECT id, telefone FROM eventos
      WHERE id = ${eventoId} AND cliente_id = ${cliente.id} LIMIT 1;
    `;
    const evento = rows[0];
    if (!evento) {
      return NextResponse.json({ erro: "Reunião não encontrada." }, { status: 404 });
    }
    if (!evento.telefone) {
      return NextResponse.json(
        { erro: "Esta reunião não tem telefone vinculado, então não há conversa para resumir." },
        { status: 400 }
      );
    }

    const briefing = await gerarBriefing({ clienteId: cliente.id, telefone: evento.telefone });
    if (!briefing) {
      return NextResponse.json(
        { erro: "Não encontrei conversa suficiente para resumir ainda." },
        { status: 422 }
      );
    }

    await sql`UPDATE eventos SET briefing = ${briefing} WHERE id = ${evento.id};`;
    return NextResponse.json({ ok: true, briefing });
  } catch (e) {
    console.error("briefing_rota_erro:", e);
    return NextResponse.json({ erro: "Falha ao gerar o resumo." }, { status: 500 });
  }
}
