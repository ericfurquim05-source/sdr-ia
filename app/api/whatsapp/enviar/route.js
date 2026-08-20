import { NextResponse } from "next/server";
import { exigirCliente } from "@/lib/auth";
import { enviarTexto, enviarTemplate, whatsappConfigurado } from "@/lib/whatsapp";

/* Envio manual pela tela de WhatsApp do site. */
export async function POST(request) {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  try {
    const { telefone, texto } = await request.json();
    if (!telefone || !texto) {
      return NextResponse.json({ erro: "Informe telefone e texto." }, { status: 400 });
    }
    if (!whatsappConfigurado()) {
      return NextResponse.json(
        { erro: "WhatsApp ainda não conectado. Configure as variáveis WHATSAPP_* na Vercel." },
        { status: 400 }
      );
    }

    // Dentro da janela de 24h vai texto livre; fora, tenta o template
    let envio = await enviarTexto({
      clienteId: cliente.id,
      precoConversa: cliente.preco_conversa,
      telefone,
      texto,
    });

    if (!envio.ok && envio.motivo === "fora_da_janela_24h") {
      envio = await enviarTemplate({
        clienteId: cliente.id,
        precoConversa: cliente.preco_conversa,
        telefone,
        nome: "",
      });
      if (envio.ok) {
        return NextResponse.json({
          ok: true,
          aviso: "Fora da janela de 24h: enviado o template aprovado no lugar do texto livre.",
        });
      }
    }

    if (!envio.ok) {
      return NextResponse.json({ erro: `Falha no envio: ${envio.motivo}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
