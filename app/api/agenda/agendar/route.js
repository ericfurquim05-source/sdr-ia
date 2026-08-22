import { NextResponse } from "next/server";
import { segredoAgendaConfere } from "@/lib/seguranca";
import { sql, garantirTabelas } from "@/lib/db";
import { agendarReuniao } from "@/lib/agenda";

export const dynamic = "force-dynamic";

/*
 * Custom Function "agendar_reuniao" da Retell. Valida regra e
 * conflito em lib/agenda.js antes de gravar — a IA não consegue
 * marcar fora da janela nem em cima de outro compromisso.
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
    const clienteId = corpo?.call?.metadata?.cliente_id ?? null;
    const contatoId = corpo?.call?.metadata?.contato_id ?? null;
    const args = corpo?.args ?? {};

    if (!clienteId) {
      return NextResponse.json({ erro: "cliente_nao_identificado" }, { status: 400 });
    }

    // Nome e telefone a partir do contato da chamada
    let nome = String(args.nome || "").trim();
    let telefone = null;
    if (contatoId) {
      await garantirTabelas();
      const { rows } = await sql`SELECT nome, telefone FROM contatos WHERE id = ${contatoId} LIMIT 1;`;
      nome = nome || rows[0]?.nome || "";
      telefone = rows[0]?.telefone ?? null;
    }

    const resultado = await agendarReuniao({
      clienteId,
      data: args.data,
      hora: args.hora,
      nome,
      telefone,
      callId: corpo?.call?.call_id ?? null,
    });

    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
