import { NextResponse } from "next/server";
import { garantirTabela, sql } from "@/lib/db";
import { processarProximoDaFila } from "@/lib/fila";

export const maxDuration = 60;

/*
 * ============================================================
 * PROCESSADOR MANUAL / CRON — REDE DE SEGURANÇA DA FILA
 * ============================================================
 * A fila anda sozinha pelo webhook (cada call_ended disca o
 * próximo). Esta rota existe para dois casos:
 *
 * 1. Cron diário da Vercel (vercel.json): se algum webhook se
 *    perder e a cadeia parar, o cron religa a fila.
 *    Também destrava contatos presos em EM_LIGACAO há mais de
 *    15 minutos (webhook perdido), contando como tentativa.
 *
 * 2. Chamada manual: abrir /api/campanhas/processar no navegador
 *    retoma a fila na hora e mostra um resumo dos status.
 */
export async function GET() {
  if (!process.env.POSTGRES_URL) {
    return NextResponse.json({ erro: true, mensagem: "Banco não configurado." }, { status: 500 });
  }

  await garantirTabela();

  // Destrava chamadas penduradas (webhook perdido): conta como falha
  await sql`
    UPDATE contatos SET
      tentativas    = tentativas + 1,
      status        = CASE WHEN tentativas + 1 >= 7 THEN 'ESGOTADO' ELSE 'PENDENTE' END,
      ultimo_motivo = 'travada_em_ligacao (destravada pelo cron)',
      call_id       = NULL,
      atualizado_em = NOW()
    WHERE status = 'EM_LIGACAO' AND atualizado_em < NOW() - INTERVAL '15 minutes';
  `;

  const resultado = await processarProximoDaFila();

  const { rows: resumo } = await sql`
    SELECT status, COUNT(*)::int AS total FROM contatos GROUP BY status ORDER BY status;
  `;

  return NextResponse.json({ fila: resultado, resumo });
}
