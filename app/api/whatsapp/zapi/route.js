import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { normalizarTelefone } from "@/lib/planilha";
import { autorespostaLigada, responderComoSdr } from "@/lib/ia";
import { enviarTexto, ritmoDeDigitacao } from "@/lib/whatsapp";
import { transcreverAudio, transcricaoDisponivel } from "@/lib/transcricao";
import { segredoZapiConfere } from "@/lib/seguranca";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * ============================================================
 * WEBHOOK DA Z-API — MENSAGENS RECEBIDAS
 * ============================================================
 * Configure no painel da Z-API, em "Webhooks", o campo
 * "Ao receber mensagem":
 *   https://SEU-PROJETO.vercel.app/api/whatsapp/zapi
 *
 * A Z-API envia um JSON com phone, text.message e fromMe.
 * Mensagens enviadas por nós (fromMe) são ignoradas para não
 * criar eco.
 */
export async function POST(request) {
  try {
    // Só a Z-API conhece o segredo embutido na URL do webhook.
    // Sem ele, qualquer um forjaria "mensagens do lead" e faria a
    // Lara responder — gastando IA e enviando pelo nosso número.
    if (!segredoZapiConfere(request)) {
      console.warn("webhook_zapi_rejeitado: segredo ausente ou errado");
      return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
    }

    const corpo = await request.json().catch(() => ({}));

    // Ignora o que nós mesmos enviamos e eventos que não são mensagem
    if (corpo?.fromMe) return NextResponse.json({ recebido: true });

    // Mensagem de GRUPO nunca entra: a Lara responderia dentro do
    // grupo, na frente de todo mundo — e conversa de grupo não é lead.
    if (corpo?.isGroup || corpo?.broadcast) {
      return NextResponse.json({ recebido: true });
    }

    // A Z-API entrega cada tipo de mensagem num formato diferente.
    // Sem tratar todos, áudio e imagem chegariam e seriam descartados
    // em silêncio — o lead falaria e ninguém veria.
    const texto =
      corpo?.text?.message ??
      corpo?.message?.text ??
      corpo?.body ??
      corpo?.buttonsResponseMessage?.message ??
      corpo?.listResponseMessage?.message ??
      (corpo?.audio ? "[áudio recebido]" : null) ??
      (corpo?.image ? `[imagem recebida]${corpo.image.caption ? " " + corpo.image.caption : ""}` : null) ??
      (corpo?.video ? `[vídeo recebido]${corpo.video.caption ? " " + corpo.video.caption : ""}` : null) ??
      (corpo?.document ? "[documento recebido]" : null) ??
      (corpo?.sticker ? "[figurinha recebida]" : null) ??
      (corpo?.contact ? "[contato compartilhado]" : null) ??
      (corpo?.location ? "[localização compartilhada]" : null) ??
      null;

    if (!texto) return NextResponse.json({ recebido: true, aviso: "sem_conteudo_legivel" });

    // Link do anexo, para tocar o áudio ou exibir a imagem na conversa
    const midiaUrl =
      corpo?.audio?.audioUrl ??
      corpo?.audio?.url ??
      corpo?.image?.imageUrl ??
      corpo?.image?.url ??
      corpo?.video?.videoUrl ??
      corpo?.video?.url ??
      corpo?.document?.documentUrl ??
      corpo?.document?.url ??
      null;

    const midiaTipo = corpo?.audio
      ? "audio"
      : corpo?.image
        ? "imagem"
        : corpo?.video
          ? "video"
          : corpo?.document
            ? "documento"
            : null;

    const telefone = normalizarTelefone(corpo?.phone ?? corpo?.from ?? "");
    if (!telefone) return NextResponse.json({ recebido: true });

    await garantirTabelas();

    // De qual cliente é este contato?
    const { rows } = await sql`
      SELECT cliente_id FROM contatos WHERE telefone = ${telefone}
      ORDER BY atualizado_em DESC LIMIT 1;
    `;
    const clienteId = rows[0]?.cliente_id;
    if (!clienteId) return NextResponse.json({ recebido: true });

    // Áudio vira texto antes de gravar: assim a IA entende o que
    // a pessoa falou em vez de pedir para ela repetir por escrito.
    let textoFinal = texto;
    if (midiaTipo === "audio" && midiaUrl && transcricaoDisponivel()) {
      const falado = await transcreverAudio(midiaUrl);
      if (falado) textoFinal = falado;
    }

    await sql`
      INSERT INTO mensagens_wa (cliente_id, telefone, direcao, texto, midia_url, midia_tipo)
      VALUES (${clienteId}, ${telefone}, 'in', ${textoFinal}, ${midiaUrl}, ${midiaTipo});
    `;

    // A Lara só responde a texto de verdade. Mídia é registrada,
    // mas responder "[áudio recebido]" geraria resposta sem sentido.
    const ehTextoReal = !textoFinal.startsWith("[");

    // A Lara responde com o contexto da ligação
    if (autorespostaLigada() && ehTextoReal) {
      try {
        const resposta = await responderComoSdr({ clienteId, telefone });
        if (resposta) {
          const { rows: cli } = await sql`
            SELECT preco_conversa FROM clientes WHERE id = ${clienteId} LIMIT 1;
          `;
          const preco = cli[0]?.preco_conversa ?? 0.5;

          // A IA separa a resposta com || para simular quem digita
          // várias mensagens curtas. Enviamos uma de cada vez, com
          // uma pausa curta entre elas, como uma pessoa faria.
          const partes = String(resposta)
            .split("||")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 4);

          for (let i = 0; i < partes.length; i++) {
            await enviarTexto({
              clienteId,
              precoConversa: i === 0 ? preco : 0, // cobra a janela uma vez só
              telefone,
              texto: partes[i],
              /*
               * A humanização acontece do lado da Z-API, na tela do
               * lead: antes do primeiro balão há uma pausa de
               * "leitura" (ninguém responde no segundo em que a
               * mensagem chega) e, antes de cada balão, o status
               * "Digitando..." fica visível por um tempo
               * proporcional ao tamanho do texto.
               */
              ritmo: {
                delayMessage: i === 0 ? 2 + Math.floor(Math.random() * 3) : 1,
                delayTyping: ritmoDeDigitacao(partes[i]),
              },
            });
            /*
             * Intervalo curto apenas para garantir a ordem de
             * entrada na fila da Z-API — o ritmo humano quem faz
             * é o delayTyping acima, fora da Vercel.
             */
            if (i < partes.length - 1) {
              await new Promise((r) => setTimeout(r, 600));
            }
          }
        }
      } catch (e) {
        console.error("autoresposta_zapi_erro:", e);
      }
    }

    return NextResponse.json({ recebido: true });
  } catch (e) {
    console.error("zapi_webhook_erro:", e);
    return NextResponse.json({ recebido: true });
  }
}
