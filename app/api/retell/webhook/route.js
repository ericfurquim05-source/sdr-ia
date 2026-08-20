import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  acharContatoDaChamada,
  registrarFalha,
  registrarSucesso,
  preencherVagas,
  pausarCampanha,
} from "@/lib/fila";
import { cobrarLigacao, saldoAtual } from "@/lib/saldo";

export const maxDuration = 60;

/*
 * ============================================================
 * AQUI ENTRA O WEBHOOK DA RETELL
 * ============================================================
 * Configure no painel da Retell (Settings → Webhooks):
 *   https://SEU-PROJETO.vercel.app/api/retell/webhook
 *
 * O QUE ACONTECE A CADA call_ended:
 *   1. Classifica: CONCLUIDA (atendeu E falou > 13s) ou falha
 *      (+1 tentativa, volta a PENDENTE; na 7ª vira ESGOTADO)
 *   2. COBRA a ligação, proporcional aos segundos falados.
 *      Caixa postal e queda rápida não são cobradas.
 *   3. Se o saldo zerou, PAUSA a campanha do cliente.
 *   4. Se ainda há saldo, disca o próximo da fila.
 */

const DURACAO_MINIMA_MS = 13000;

// Motivos que caracterizam falha, independentemente da duração
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
  try {
    return await tratarEvento(request);
  } catch (e) {
    // Nunca devolve 500: a Retell reenviaria o evento em loop.
    // O erro fica no log da Vercel para diagnóstico.
    console.error("webhook_retell_erro:", e);
    return NextResponse.json({ recebido: true, erro: String(e?.message || e).slice(0, 200) });
  }
}

async function tratarEvento(request) {
  const corpo = await request.json();
  const evento = corpo.event;
  const chamada = corpo.call ?? corpo.data ?? {};

  switch (evento) {
    case "call_started":
      break; // conectou na operadora; aguardamos o desfecho

    case "call_ended": {
      const contato = await acharContatoDaChamada(chamada.metadata, chamada.call_id);
      if (!contato) break; // chamada avulsa (teste no painel da Retell)

      const clienteId = contato.cliente_id;
      const duracaoMs =
        chamada.duration_ms ??
        (chamada.end_timestamp && chamada.start_timestamp
          ? chamada.end_timestamp - chamada.start_timestamp
          : 0);
      const motivo = chamada.disconnection_reason ?? "desconhecido";
      const segundos = Math.round(duracaoMs / 1000);

      const atendeu = !MOTIVOS_DE_FALHA.has(motivo);
      const conversaReal = duracaoMs > DURACAO_MINIMA_MS;

      // ---- 1. Status do contato ----
      if (atendeu && conversaReal) {
        await registrarSucesso(contato.id, `${motivo} (${segundos}s)`);
      } else {
        await registrarFalha(contato.id, `${motivo} (${segundos}s)`);
      }

      // ---- 2. Cobrança proporcional aos segundos falados ----
      const { rows } = await sql`SELECT preco_minuto FROM clientes WHERE id = ${clienteId} LIMIT 1;`;
      const precoMinuto = rows[0]?.preco_minuto ?? 1.5;

      let custo = 0;
      if (atendeu && conversaReal) {
        const cobranca = await cobrarLigacao({
          clienteId,
          precoMinuto,
          duracaoMs,
          callId: chamada.call_id, // trava anti-cobrança-dupla
        });
        custo = cobranca.valor;
      }

      // ---- 2b. Registra a chamada no histórico (alimenta o Dashboard) ----
      await sql`
        INSERT INTO ligacoes
          (cliente_id, contato_id, call_id, nome, telefone, agente,
           duracao_ms, motivo, sucesso, custo, recording_url, transcript)
        VALUES
          (${clienteId}, ${contato.id}, ${chamada.call_id ?? null}, ${contato.nome ?? ""},
           ${contato.telefone ?? ""}, ${contato.agente ?? "fria"}, ${duracaoMs}, ${motivo},
           ${atendeu && conversaReal}, ${custo}, ${chamada.recording_url ?? null},
           ${typeof chamada.transcript === "string" ? chamada.transcript : null})
        ON CONFLICT (call_id) DO NOTHING;
      `;

      // ---- 3. Saldo zerou? Pausa a campanha ----
      const saldo = await saldoAtual(clienteId);
      if (saldo <= 0) {
        await pausarCampanha(clienteId, "saldo_esgotado");
        break;
      }

      // ---- 4. Libera a vaga: puxa o próximo da fila ----
      await preencherVagas(clienteId);
      break;
    }

    case "call_analyzed": {
      // Salva o resumo pós-chamada gerado pela Retell
      const resumo = chamada.call_analysis?.call_summary;
      if (resumo && chamada.call_id) {
        await sql`UPDATE ligacoes SET resumo = ${resumo} WHERE call_id = ${chamada.call_id};`;
      }
      // TODO: criar evento no calendário quando
      // custom_analysis_data.reuniao_agendada = true.
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ recebido: true });
}
