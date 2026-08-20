import { garantirTabelas, sql } from "@/lib/db";
import { cobrarConversaWhatsapp } from "@/lib/saldo";

/*
 * ============================================================
 * WHATSAPP — META CLOUD API (API OFICIAL DO FACEBOOK BUSINESS)
 * ============================================================
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

export function whatsappConfigurado() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

// Telefone local (51980554326) -> formato Meta (5551980554326)
function paraMeta(telefone) {
  const n = String(telefone).replace(/\D/g, "");
  return n.startsWith("55") && n.length >= 12 ? n : "55" + n;
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
  const template = process.env.WHATSAPP_TEMPLATE;
  if (!whatsappConfigurado() || !template) {
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

  if (!ok) return { ok: false, motivo: JSON.stringify(dados).slice(0, 300) };

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
  if (!whatsappConfigurado()) return { ok: false, motivo: "whatsapp_nao_configurado" };

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
