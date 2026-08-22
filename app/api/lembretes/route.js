import { NextResponse } from "next/server";
import { processarLembretes } from "@/lib/lembretes";
import { compararSeguro } from "@/lib/seguranca";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * ============================================================
 * DESPERTADOR DOS LEMBRETES
 * ============================================================
 * O cron da Vercel roda 1x por dia — pouco para lembrete de 45
 * minutos. Esta rota existe para um despertador externo gratuito
 * (cron-job.org, UptimeRobot) bater de 10 em 10 minutos:
 *   GET /api/lembretes?chave=CRON_SECRET
 * Também aceita o cabeçalho Bearer do cron oficial da Vercel.
 * Os webhooks de ligação e de WhatsApp acionam o mesmo motor a
 * cada movimento, então em dia de campanha isto é redundância —
 * em dia parado, é o que garante o lembrete.
 */
export async function GET(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado na Vercel." }, { status: 500 });
  }

  const url = new URL(request.url);
  const chave = url.searchParams.get("chave") || "";
  const autorizacao = request.headers.get("authorization") || "";
  const autorizado =
    compararSeguro(chave, segredo) || compararSeguro(autorizacao, `Bearer ${segredo}`);

  if (!autorizado) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  try {
    const resultado = await processarLembretes();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    return NextResponse.json(
      { erro: String(e?.message || e).slice(0, 200) },
      { status: 500 }
    );
  }
}
