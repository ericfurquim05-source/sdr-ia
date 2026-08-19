import { NextResponse } from "next/server";

/*
 * ============================================================
 * AQUI ENTRA O WEBHOOK DA RETELL
 * ============================================================
 * Configure no painel da Retell (Webhooks) a URL:
 *   https://SEU-PROJETO.vercel.app/api/retell/webhook
 *
 * A Retell envia um POST para esta rota a cada evento da chamada.
 * Recomendado em produção: validar a assinatura do cabeçalho
 * "x-retell-signature" antes de processar o evento.
 */
export async function POST(request) {
  const evento = await request.json();

  switch (evento.event) {
    case "call_started":
      // Chamada iniciada — atualizar status do contato para "Em ligação"
      console.log("Chamada iniciada:", evento.call?.call_id);
      break;

    case "call_ended":
      // Chamada encerrada — dados principais para a aba "SDR IA":
      //   evento.call.recording_url  -> URL do áudio (mini player)
      //   evento.call.transcript     -> transcrição completa
      //   evento.call.duration_ms    -> duração (para cobrar a minutagem)
      //   evento.call.disconnection_reason -> ex.: "voicemail_reached"
      //
      // TODO: salvar no banco de dados (ex.: Supabase/Postgres) e
      // debitar os minutos do saldo pré-pago do usuário.
      console.log("Chamada encerrada:", evento.call?.call_id);
      break;

    case "call_analyzed":
      // Análise pós-chamada — dados para o resumo e o calendário:
      //   evento.call.call_analysis.call_summary   -> resumo da ligação
      //   evento.call.call_analysis.user_sentiment -> sentimento do lead
      //   evento.call.call_analysis.custom_analysis_data
      //     -> campos personalizados definidos no agente, ex.:
      //        { reuniao_agendada: true, data_reuniao: "2026-08-21T10:30" }
      //
      // TODO: se houver reunião agendada, criar o evento no calendário
      // com origem "ia" (destaque violeta na interface).
      console.log("Chamada analisada:", evento.call?.call_id);
      break;

    default:
      console.log("Evento não tratado:", evento.event);
  }

  // Sempre responder 200 rapidamente para a Retell não reenviar o evento
  return NextResponse.json({ recebido: true });
}
