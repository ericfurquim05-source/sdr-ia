import { garantirTabelas, sql } from "@/lib/db";
import { cobrarConversaWhatsapp } from "@/lib/saldo";

/*
 * ============================================================
 * WHATSAPP — DOIS CAMINHOS POSSÍVEIS
 * ============================================================
 * O sistema envia por um dos dois, conforme o que estiver
 * configurado nas variáveis:
 *
 * 1. Z-API (mais simples): conecta lendo um QR code, como o
 *    WhatsApp Web. Não exige template aprovado nem verificação
 *    da Meta. Variáveis: ZAPI_INSTANCIA, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN.
 *
 * 2. Meta Cloud API (oficial): mais robusta e sem risco de
 *    bloqueio, mas exige número registrado e template aprovado.
 *
 * Se as duas estiverem configuradas, a Meta tem prioridade.
 * ============================================================
 * META CLOUD API
 * Variáveis (Meta for Developers → seu app → WhatsApp):
 *   WHATSAPP_TOKEN            token permanente do sistema
 *   WHATSAPP_PHONE_NUMBER_ID  id do número (não é o telefone)
 *   WHATSAPP_TEMPLATE         nome do template aprovado (ex.: followup_ligacao)
 *   WHATSAPP_VERIFY_TOKEN     senha que você inventa p/ validar o webhook
 *
 * REGRA DA META: mensagem de texto livre só dentro da janela de
 * 24h após a ÚLTIMA mensagem recebida do cliente. Fora dela, só
 * TEMPLATE aprovado. O código respeita isso sozinho.
 */

const API = "https://graph.facebook.com/v20.0";

/** A Z-API está pronta para uso? */
export function zapiConfigurado() {
  return Boolean(process.env.ZAPI_INSTANCIA && process.env.ZAPI_TOKEN);
}

/** A API oficial da Meta está pronta para uso? */
export function metaConfigurado() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Existe algum caminho de envio disponível? */
export function whatsappConfigurado() {
  return metaConfigurado() || zapiConfigurado();
}

/** Qual caminho será usado — a Meta tem prioridade quando existe. */
export function canalAtivo() {
  if (metaConfigurado()) return "meta";
  if (zapiConfigurado()) return "zapi";
  return null;
}

/*
 * ------------------------------------------------------------
 * ENVIO PELA Z-API
 * ------------------------------------------------------------
 * A Z-API não trabalha com template: manda texto direto.
 * Por isso o follow-up automático usa o mesmo texto do template,
 * já com o nome preenchido.
 */
async function enviarPelaZapi(telefone, texto) {
  const url = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCIA}/token/${process.env.ZAPI_TOKEN}/send-text`;

  const cabecalhos = { "Content-Type": "application/json" };
  // Alguns planos exigem o token de segurança da conta
  if (process.env.ZAPI_CLIENT_TOKEN) {
    cabecalhos["Client-Token"] = process.env.ZAPI_CLIENT_TOKEN;
  }

  const resposta = await fetch(url, {
    method: "POST",
    headers: cabecalhos,
    body: JSON.stringify({ phone: paraMeta(telefone), message: texto }),
  });

  const dados = await resposta.json().catch(() => ({}));
  return { ok: resposta.ok && !dados?.error, dados };
}

/** Texto do primeiro contato, quando não há template (Z-API). */
function textoDeFollowUp(nome) {
  const tratamento = nome ? `Olá ${nome}!` : "Olá!";
  return `${tratamento} Tentamos falar com você por telefone há pouco, mas não conseguimos contato. Podemos continuar por aqui? Se preferir, é só responder esta mensagem. 😊`;
}

// Telefone local (51980554326) -> formato Meta (5551980554326)
function paraMeta(telefone) {
  const n = String(telefone).replace(/\D/g, "");
  return n.startsWith("55") && n.length >= 12 ? n : "55" + n;
}

// Erros da Meta que significam "este número não tem WhatsApp"
function numeroSemWhatsapp(dados) {
  const codigo = dados?.error?.code;
  const texto = JSON.stringify(dados?.error ?? {}).toLowerCase();
  return (
    codigo === 131026 || // message undeliverable
    texto.includes("not a valid whatsapp user") ||
    texto.includes("recipient is not a valid")
  );
}

async function chamarMeta(payload) {
  const resposta = await fetch(`${API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const dados = await resposta.json().catch(() => ({}));
  return { ok: resposta.ok, dados };
}

/** true se o cliente mandou mensagem nas últimas 24h (janela aberta). */
export async function janelaAberta(clienteId, telefone) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT id FROM mensagens_wa
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone}
      AND direcao = 'in' AND criado_em > NOW() - INTERVAL '24 hours'
    LIMIT 1;
  `;
  return rows.length > 0;
}

/** Envia TEMPLATE aprovado (funciona fora da janela de 24h). */
export async function enviarTemplate({ clienteId, precoConversa, telefone, nome }) {
  const canal = canalAtivo();
  if (!canal) return { ok: false, motivo: "whatsapp_nao_configurado" };

  // ---- Caminho Z-API: texto direto, sem template ----
  if (canal === "zapi") {
    const { ok, dados } = await enviarPelaZapi(telefone, textoDeFollowUp(nome));
    if (!ok) {
      return { ok: false, motivo: JSON.stringify(dados).slice(0, 300) };
    }
    await garantirTabelas();
    await sql`
      INSERT INTO mensagens_wa (cliente_id, telefone, direcao, texto)
      VALUES (${clienteId}, ${telefone}, 'out', ${textoDeFollowUp(nome)});
    `;
    await sql`UPDATE contatos SET tem_whatsapp = TRUE
              WHERE cliente_id = ${clienteId} AND telefone = ${telefone};`;
    await cobrarConversaWhatsapp({ clienteId, precoConversa, telefone });
    return { ok: true };
  }

  // ---- Caminho Meta: template aprovado ----
  const template = process.env.WHATSAPP_TEMPLATE;
  if (!template) {
    return { ok: false, motivo: "whatsapp_nao_configurado" };
  }

  const { ok, dados } = await chamarMeta({
    messaging_product: "whatsapp",
    to: paraMeta(telefone),
    type: "template",
    template: {
      name: template,
      language: { code: "pt_BR" },
      components: [
        { type: "body", parameters: [{ type: "text", text: nome || "tudo bem" }] },
      ],
    },
  });

  if (!ok) {
    // FILTRO: número sem WhatsApp → registra e marca para nunca reenviar.
    // A fila de LIGAÇÕES não depende disso e segue normalmente.
    if (numeroSemWhatsapp(dados)) {
      await garantirTabelas();
      await sql`UPDATE contatos SET tem_whatsapp = FALSE, whatsapp_enviado = TRUE
                WHERE cliente_id = ${clienteId} AND telefone = ${telefone};`;
      await sql`INSERT INTO mensagens_wa (cliente_id, telefone, direcao, texto)
                VALUES (${clienteId}, ${telefone}, 'out', '[não entregue — número sem WhatsApp]');`;
      return { ok: false, motivo: "sem_whatsapp" };
    }
    return { ok: false, motivo: JSON.stringify(dados).slice(0, 300) };
  }

  // Entregou → o número tem WhatsApp
  await garantirTabelas();
  await sql`UPDATE contatos SET tem_whatsapp = TRUE
            WHERE cliente_id = ${clienteId} AND telefone = ${telefone};`;

  await garantirTabelas();
  await sql`
    INSERT INTO mensagens_wa (cliente_id, telefone, direcao, texto)
    VALUES (${clienteId}, ${telefone}, 'out', ${`[template ${template}] enviado para ${nome || telefone}`});
  `;
  // Cobra R$ 0,50 se abriu janela nova (mesma janela não recobra)
  await cobrarConversaWhatsapp({ clienteId, precoConversa, telefone });
  return { ok: true };
}

/** Envia texto livre (só dentro da janela de 24h). */
export async function enviarTexto({ clienteId, precoConversa, telefone, texto }) {
  const canal = canalAtivo();
  if (!canal) return { ok: false, motivo: "whatsapp_nao_configurado" };

  // ---- Caminho Z-API: texto livre a qualquer momento ----
  if (canal === "zapi") {
    const { ok, dados } = await enviarPelaZapi(telefone, texto);
    if (!ok) return { ok: false, motivo: JSON.stringify(dados).slice(0, 300) };

    await garantirTabelas();
    await sql`
      INSERT INTO mensagens_wa (cliente_id, telefone, direcao, texto)
      VALUES (${clienteId}, ${telefone}, 'out', ${texto});
    `;
    await cobrarConversaWhatsapp({ clienteId, precoConversa, telefone });
    return { ok: true };
  }

  // ---- Caminho Meta: só dentro da janela de 24h ----
  if (!(await janelaAberta(clienteId, telefone))) {
    return { ok: false, motivo: "fora_da_janela_24h" };
  }

  const { ok, dados } = await chamarMeta({
    messaging_product: "whatsapp",
    to: paraMeta(telefone),
    type: "text",
    text: { body: texto },
  });

  if (!ok) return { ok: false, motivo: JSON.stringify(dados).slice(0, 300) };

  await sql`
    INSERT INTO mensagens_wa (cliente_id, telefone, direcao, texto)
    VALUES (${clienteId}, ${telefone}, 'out', ${texto});
  `;
  await cobrarConversaWhatsapp({ clienteId, precoConversa, telefone });
  return { ok: true };
}
