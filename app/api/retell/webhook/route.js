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
import { enviarTemplate, whatsappConfigurado } from "@/lib/whatsapp";

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
 *   2. COBRA a ligação, proporcional aos segundos conectados —
 *      inclusive caixa postal e chamadas curtas, pois a operadora
 *      cobra esses segundos de nós. Só chamada de 0s não gera custo.
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
      let resultadoFalha = null;
      if (atendeu && conversaReal) {
        await registrarSucesso(contato.id, `${motivo} (${segundos}s)`);
      } else {
        resultadoFalha = await registrarFalha(contato.id, `${motivo} (${segundos}s)`);
      }

      // ---- 2. Cobrança proporcional aos segundos falados ----
      const { rows } = await sql`SELECT preco_minuto FROM clientes WHERE id = ${clienteId} LIMIT 1;`;
      const precoMinuto = rows[0]?.preco_minuto ?? 1.5;

      // Cobra TODO segundo conectado — inclusive caixa postal e
      // chamadas curtas — porque a operadora nos cobra por eles.
      // A régua de sucesso (>13s) segue valendo só para o STATUS.
      const cobranca = await cobrarLigacao({
        clienteId,
        precoMinuto,
        duracaoMs,
        callId: chamada.call_id, // trava anti-cobrança-dupla
      });
      const custo = cobranca.valor;

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

      // ---- 2c. FOLLOW-UP AUTOMÁTICO NO WHATSAPP ----
      // Não conseguiu contato por telefone após N tentativas?
      // Manda o template aprovado uma única vez por contato.
      const disparoApos = Number(process.env.WHATSAPP_APOS_TENTATIVAS || 3);
      if (
        resultadoFalha &&
        !contato.whatsapp_enviado &&
        whatsappConfigurado() &&
        (resultadoFalha.tentativas >= disparoApos || resultadoFalha.novoStatus === "ESGOTADO")
      ) {
        const { rows: cli } = await sql`
          SELECT preco_conversa FROM clientes WHERE id = ${clienteId} LIMIT 1;
        `;
        const envio = await enviarTemplate({
          clienteId,
          precoConversa: cli[0]?.preco_conversa ?? 0.5,
          telefone: contato.telefone,
          nome: contato.nome,
        });
        if (envio.ok) {
          await sql`UPDATE contatos SET whatsapp_enviado = TRUE WHERE id = ${contato.id};`;
        }
      }

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

      // ---- REUNIÃO MARCADA PELA IA → ENTRA NO CALENDÁRIO ----
      // Requer, no agente da Retell (Post-Call Analysis), os campos:
      //   reuniao_agendada (boolean), data_reuniao (YYYY-MM-DD),
      //   hora_reuniao (HH:MM)
      const analise = chamada.call_analysis?.custom_analysis_data ?? {};
      if (analise.reuniao_agendada && chamada.call_id) {
        const contatoDaCall = await acharContatoDaChamada(chamada.metadata, chamada.call_id);
        if (contatoDaCall) {
          const data = String(analise.data_reuniao || "").trim();
          const hora = String(analise.hora_reuniao || "09:00").trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            await sql`
              INSERT INTO eventos (cliente_id, titulo, inicio, origem, telefone, call_id)
              SELECT
                ${contatoDaCall.cliente_id},
                ${"Reunião — " + (contatoDaCall.nome || contatoDaCall.telefone)},
                (${data + " " + hora})::timestamp AT TIME ZONE 'America/Sao_Paulo',
                'ia', ${contatoDaCall.telefone}, ${chamada.call_id}
              WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE call_id = ${chamada.call_id});
            `;
          }
        }
      }
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ recebido: true });
}
