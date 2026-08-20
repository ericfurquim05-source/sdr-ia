import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { normalizarTelefone } from "@/lib/planilha";

/*
 * ============================================================
 * WEBHOOK DO WHATSAPP (META CLOUD API)
 * ============================================================
 * Configure no Meta for Developers → app → WhatsApp → Configuration:
 *   Callback URL:  https://SEU-PROJETO.vercel.app/api/whatsapp/webhook
 *   Verify token:  o mesmo valor da variável WHATSAPP_VERIFY_TOKEN
 * e assine o campo "messages".
 */

// A Meta valida o webhook com um GET de desafio
export async function GET(request) {
  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const desafio = url.searchParams.get("hub.challenge");

  if (modo === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(desafio, { status: 200 });
  }
  return new Response("token_invalido", { status: 403 });
}

// Mensagens recebidas dos leads
export async function POST(request) {
  try {
    const corpo = await request.json();
    await garantirTabelas();

    for (const entrada of corpo.entry ?? []) {
      for (const mudanca of entrada.changes ?? []) {
        for (const msg of mudanca.value?.messages ?? []) {
          const texto =
            msg.text?.body ??
            msg.button?.text ??
            msg.interactive?.button_reply?.title ??
            "[mídia recebida]";
          const telefone = normalizarTelefone(msg.from);
          if (!telefone) continue;

          // A qual cliente pertence esta conversa? Ao dono do contato.
          const { rows } = await sql`
            SELECT cliente_id FROM contatos WHERE telefone = ${telefone}
            ORDER BY atualizado_em DESC LIMIT 1;
          `;
          const clienteId = rows[0]?.cliente_id;
          if (!clienteId) continue; // número desconhecido: ignora

          await sql`
            INSERT INTO mensagens_wa (cliente_id, telefone, direcao, texto)
            VALUES (${clienteId}, ${telefone}, 'in', ${texto});
          `;
        }
      }
    }
  } catch (e) {
    console.error("whatsapp_webhook_erro:", e);
  }
  // Sempre 200 para a Meta não reenviar
  return NextResponse.json({ recebido: true });
}
