import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/*
 * A Retell chama esta rota (Custom Function "agendar_reuniao")
 * quando o lead escolhe um horário. Valida as regras e o conflito
 * antes de gravar — a IA não consegue marcar fora da janela nem
 * em cima de outro compromisso.
 *
 * args esperados: { data: "YYYY-MM-DD", hora: "HH:MM", nome?: string }
 */
export async function POST(request) {
  try {
    const corpo = await request.json().catch(() => ({}));
    const clienteId = corpo?.call?.metadata?.cliente_id ?? null;
    const contatoId = corpo?.call?.metadata?.contato_id ?? null;
    const args = corpo?.args ?? {};
    const data = String(args.data || "").trim();
    const hora = String(args.hora || "").trim();

    if (!clienteId) {
      return NextResponse.json({ erro: "cliente_nao_identificado" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
      return NextResponse.json({ sucesso: false, motivo: "Data ou hora em formato inválido." });
    }

    // ---- Regras: seg-sáb, 08h às 21h ----
    const inicioSp = new Date(`${data}T${hora}:00-03:00`);
    const diaSemana = inicioSp.getDay();
    const h = Number(hora.slice(0, 2));
    if (diaSemana === 0) {
      return NextResponse.json({ sucesso: false, motivo: "Domingo não tem atendimento. Ofereça de segunda a sábado." });
    }
    if (h < 8 || h >= 21) {
      return NextResponse.json({ sucesso: false, motivo: "Fora da janela: só é possível agendar entre 08:00 e 21:00." });
    }
    if (inicioSp.getTime() < Date.now()) {
      return NextResponse.json({ sucesso: false, motivo: "Esse horário já passou. Ofereça um horário futuro." });
    }

    await garantirTabelas();

    // ---- Conflito: já existe evento nesse horário? ----
    const { rows: conflito } = await sql`
      SELECT id FROM eventos
      WHERE cliente_id = ${clienteId}
        AND inicio = (${data + " " + hora})::timestamp AT TIME ZONE 'America/Sao_Paulo'
      LIMIT 1;
    `;
    if (conflito.length) {
      return NextResponse.json({ sucesso: false, motivo: "Esse horário acabou de ser ocupado. Ofereça outro." });
    }

    // Nome/telefone do lead a partir do contato da chamada
    let nome = String(args.nome || "").trim();
    let telefone = null;
    if (contatoId) {
      const { rows } = await sql`SELECT nome, telefone FROM contatos WHERE id = ${contatoId} LIMIT 1;`;
      nome = nome || rows[0]?.nome || "";
      telefone = rows[0]?.telefone ?? null;
    }

    await sql`
      INSERT INTO eventos (cliente_id, titulo, inicio, origem, telefone, call_id)
      VALUES (
        ${clienteId},
        ${"Reunião — " + (nome || telefone || "lead")},
        (${data + " " + hora})::timestamp AT TIME ZONE 'America/Sao_Paulo',
        'ia', ${telefone}, ${corpo?.call?.call_id ?? null}
      );
    `;

    return NextResponse.json({
      sucesso: true,
      confirmacao: `Reunião confirmada para ${data.split("-").reverse().join("/")} às ${hora}.`,
    });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
