import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/*
 * ============================================================
 * APONTAR O WEBHOOK DA Z-API PELO PRÓPRIO SITE
 * ============================================================
 * O painel da Z-API às vezes abre em branco — e sem atualizar a
 * URL do webhook com o ?segredo=, a blindagem passa a rejeitar as
 * mensagens dos leads (401) e a Lara fica muda.
 *
 * Esta rota resolve sem painel: chama a API oficial da Z-API
 * (update-webhook-received) e aponta o webhook "Ao receber" para
 *   {URL_DO_SITE}/api/whatsapp/zapi?segredo={ZAPI_WEBHOOK_SEGREDO}
 * usando as credenciais que já estão na Vercel.
 *
 * Só o administrador executa. Basta visitar (GET):
 *   /api/whatsapp/zapi/configurar
 */
export async function GET() {
  try {
    await exigirAdmin();
  } catch {
    return NextResponse.json({ erro: "Somente o administrador." }, { status: 401 });
  }

  const instancia = process.env.ZAPI_INSTANCIA;
  const token = process.env.ZAPI_TOKEN;
  const segredo = process.env.ZAPI_WEBHOOK_SEGREDO;
  const site = (process.env.URL_DO_SITE || "").replace(/\/$/, "");

  const faltando = [
    !instancia && "ZAPI_INSTANCIA",
    !token && "ZAPI_TOKEN",
    !segredo && "ZAPI_WEBHOOK_SEGREDO",
    !site && "URL_DO_SITE",
  ].filter(Boolean);
  if (faltando.length) {
    return NextResponse.json(
      { erro: `Variáveis ausentes na Vercel: ${faltando.join(", ")}` },
      { status: 400 }
    );
  }

  const destino = `${site}/api/whatsapp/zapi?segredo=${segredo}`;

  const cabecalhos = { "Content-Type": "application/json" };
  if (process.env.ZAPI_CLIENT_TOKEN) {
    cabecalhos["Client-Token"] = process.env.ZAPI_CLIENT_TOKEN;
  }

  try {
    const resposta = await fetch(
      `https://api.z-api.io/instances/${instancia}/token/${token}/update-webhook-received`,
      {
        method: "PUT",
        headers: cabecalhos,
        body: JSON.stringify({ value: destino }),
        signal: AbortSignal.timeout(15000),
      }
    );

    const corpo = await resposta.text();
    if (!resposta.ok) {
      return NextResponse.json(
        { erro: `Z-API respondeu ${resposta.status}`, detalhe: corpo.slice(0, 300) },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      mensagem:
        "Webhook 'Ao receber' da Z-API apontado para o site COM o segredo. Mande um oi de outro número para testar.",
      // O segredo não volta na resposta: só a confirmação do destino
      destino: `${site}/api/whatsapp/zapi?segredo=***`,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: `Não consegui falar com a Z-API: ${String(e?.message || e).slice(0, 200)}` },
      { status: 502 }
    );
  }
}
