import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/*
 * ============================================================
 * AGENDA PARA A IA — HORÁRIOS REALMENTE LIVRES
 * ============================================================
 * A Retell chama esta rota DURANTE a ligação (Custom Function
 * "consultar_horarios") para oferecer só horários vagos.
 *
 * REGRAS DE DISPONIBILIDADE:
 *   · Segunda a sábado (domingo bloqueado)
 *   · Das 08:00 às 21:00 (última reunião começa às 20:00)
 *   · Cruza com a tabela "eventos": horário ocupado não aparece
 *
 * O corpo segue o padrão da Retell: { call: {...}, args: {...} }.
 * O cliente vem de call.metadata.cliente_id (nós enviamos no disparo).
 */

const HORA_MIN = 8;
const HORA_MAX = 21; // exclusivo: último slot começa às 20h
const DIAS_A_FRENTE = 10;
const MAX_SUGESTOES = 6;

export async function POST(request) {
  try {
    const corpo = await request.json().catch(() => ({}));
    const clienteId =
      corpo?.call?.metadata?.cliente_id ?? corpo?.args?.cliente_id ?? null;
    if (!clienteId) {
      return NextResponse.json({ erro: "cliente_nao_identificado" }, { status: 400 });
    }

    await garantirTabelas();

    // Horários já ocupados nos próximos dias
    const { rows: ocupados } = await sql`
      SELECT to_char(inicio AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD HH24:00') AS slot
      FROM eventos
      WHERE cliente_id = ${clienteId}
        AND inicio BETWEEN NOW() AND NOW() + INTERVAL '10 days';
    `;
    const bloqueados = new Set(ocupados.map((o) => o.slot));

    // Agora em São Paulo
    const agoraSp = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );

    const livres = [];
    for (let d = 0; d < DIAS_A_FRENTE && livres.length < MAX_SUGESTOES; d++) {
      const dia = new Date(agoraSp);
      dia.setDate(dia.getDate() + d);
      if (dia.getDay() === 0) continue; // domingo bloqueado

      for (let h = HORA_MIN; h < HORA_MAX && livres.length < MAX_SUGESTOES; h++) {
        // hoje: só horários pelo menos 2h à frente
        if (d === 0 && h <= agoraSp.getHours() + 1) continue;

        const chave = `${dia.toISOString().slice(0, 10)} ${String(h).padStart(2, "0")}:00`;
        if (bloqueados.has(chave)) continue;

        livres.push({
          data: dia.toISOString().slice(0, 10),
          hora: `${String(h).padStart(2, "0")}:00`,
          dia_semana: dia.toLocaleDateString("pt-BR", { weekday: "long" }),
          data_falada: dia.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }),
        });
      }
    }

    return NextResponse.json({
      horarios_livres: livres,
      regras: "Atendimento de segunda a sábado, das 08:00 às 21:00.",
    });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
