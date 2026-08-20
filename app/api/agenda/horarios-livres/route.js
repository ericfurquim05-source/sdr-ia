import { NextResponse } from "next/server";
import { horariosLivres } from "@/lib/agenda";

export const dynamic = "force-dynamic";

/*
 * A Retell chama esta rota DURANTE a ligação (Custom Function
 * "consultar_horarios") para oferecer só horários realmente vagos.
 * A regra fica em lib/agenda.js, compartilhada com o WhatsApp.
 */
export async function POST(request) {
  try {
    const corpo = await request.json().catch(() => ({}));
    const clienteId = corpo?.call?.metadata?.cliente_id ?? corpo?.args?.cliente_id ?? null;
    if (!clienteId) {
      return NextResponse.json({ erro: "cliente_nao_identificado" }, { status: 400 });
    }

    const resultado = await horariosLivres(clienteId);
    return NextResponse.json({
      ...resultado,
      regras: "Atendimento de segunda a sábado, das 08:00 às 21:00.",
    });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
