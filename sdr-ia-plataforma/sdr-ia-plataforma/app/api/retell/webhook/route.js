import { NextResponse } from "next/server";
import { acharContatoDaChamada, registrarFalha, registrarSucesso, processarProximoDaFila } from "@/lib/fila";

export const maxDuration = 60;

/*
 * ============================================================
 * AQUI ENTRA O WEBHOOK DA RETELL
 * ============================================================
 * Configure no painel da Retell (Settings → Webhooks):
 *   https://SEU-PROJETO.vercel.app/api/retell/webhook
 *
 * REGRA DE NEGÓCIO (validação de sucesso / filtro de caixa postal):
 *   CONCLUIDA  → o cliente ATENDEU e a chamada durou MAIS de 13s
 *   Falha      → não atendeu, erro de operadora, caixa postal
 *                ou duração <= 13s  ⇒  TENTATIVAS + 1 e volta a
 *                PENDENTE; na 7ª falha vira ESGOTADO (permanente).
 *
 * ENCADEAMENTO DA FILA:
 *   Todo call_ended (sucesso ou falha) chama o worker para
 *   discar o próximo PENDENTE — uma ligação por vez, sem cron.
 */

// Duração mínima (exclusiva) para considerar conversa real
const DURACAO_MINIMA_MS = 13000;

// Motivos de desconexão da Retell que caracterizam falha
// (não atendeu / caixa postal / erro), independentemente da duração
const MOTIVOS_DE_FALHA = new Set([
  "dial_no_answer",
  "dial_busy",
  "dial_failed",
  "voicemail_reached",
  "machine_detected",
  "telephony_provider_unavailable",
  "telephony_provider_permission_denied",
  "no_valid_payment",
  "error_llm_websocket_open",
  "error_frontend_corrupted_payload",
  "error_twilio",
  "error_no_audio_received",
  "error_asr",
  "error_retell",
  "error_unknown",
]);

export async function POST(request) {
  const corpo = await request.json();
  const evento = corpo.event;
  const chamada = corpo.call ?? corpo.data ?? {};

  switch (evento) {
    case "call_started":
      // Ligação conectada na operadora — nada a fazer, aguardamos o desfecho.
      break;

    case "call_ended": {
      const contato = await acharContatoDaChamada(chamada.metadata, chamada.call_id);
      if (!contato) break; // chamada avulsa (teste manual no painel, etc.)

      const duracaoMs =
        chamada.duration_ms ??
        (chamada.end_timestamp && chamada.start_timestamp
          ? chamada.end_timestamp - chamada.start_timestamp
          : 0);
      const motivo = chamada.disconnection_reason ?? "desconhecido";

      const atendeu = !MOTIVOS_DE_FALHA.has(motivo);
      const conversaReal = duracaoMs > DURACAO_MINIMA_MS; // ESTRITAMENTE > 13s

      if (atendeu && conversaReal) {
        // ✅ Sucesso: atendeu e conversou por mais de 13 segundos
        await registrarSucesso(contato.id, `${motivo} (${Math.round(duracaoMs / 1000)}s)`);
      } else {
        // ❌ Caixa postal, queda rápida, não atendida ou erro
        await registrarFalha(contato.id, `${motivo} (${Math.round(duracaoMs / 1000)}s)`);
      }

      // TODO: salvar recording_url e transcript para exibir na aba SDR IA.

      // 🔁 Devolve a vez para a fila: disca o próximo PENDENTE
      await processarProximoDaFila();
      break;
    }

    case "call_analyzed": {
      // Resumo e análise pós-chamada da Retell.
      // TODO: salvar call_analysis.call_summary e, se o agente marcar
      // reunião (custom_analysis_data.reuniao_agendada), criar o evento
      // no calendário com origem "ia".
      break;
    }

    default:
      break;
  }

  // Sempre 200 para a Retell não reenviar o evento
  return NextResponse.json({ recebido: true });
}
