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
/*
 * Ritmo humano de digitação. A Z-API aceita dois atrasos nativos
 * por mensagem, executados do lado dela (não gastam tempo da
 * função na Vercel):
 *
 *   delayMessage — segundos parada antes de começar a digitar
 *   delayTyping  — segundos exibindo "Digitando..." pro lead
 *
 * O tempo de digitação é proporcional ao tamanho do texto, como
 * uma pessoa no celular: frase curta sai rápido, frase longa
 * demora. Limite da Z-API: 1 a 15 segundos.
 */
export function ritmoDeDigitacao(texto) {
  const tamanho = String(texto || "").length;
  // ~7 caracteres por segundo: gente digitando no celular, com
  // pensamento no meio. Frase curta ~5s, frase cheia bate no teto.
  return Math.max(3, Math.min(15, Math.round(tamanho / 7) + 2));
}

async function enviarPelaZapi(telefone, texto, ritmo = null) {
  const url = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCIA}/token/${process.env.ZAPI_TOKEN}/send-text`;

  const cabecalhos = { "Content-Type": "application/json" };
  // Alguns planos exigem o token de segurança da conta
  if (process.env.ZAPI_CLIENT_TOKEN) {
    cabecalhos["Client-Token"] = process.env.ZAPI_CLIENT_TOKEN;
  }

  const corpo = { phone: paraMeta(telefone), message: texto };
  if (ritmo?.delayTyping) corpo.delayTyping = ritmo.delayTyping;
  if (ritmo?.delayMessage) corpo.delayMessage = ritmo.delayMessage;

  const resposta = await fetch(url, {
    method: "POST",
    headers: cabecalhos,
    body: JSON.stringify(corpo),
  });

  const dados = await resposta.json().catch(() => ({}));
  return { ok: resposta.ok && !dados?.error, dados };
}

/**
 * Pergunta à Z-API se o celular está realmente conectado.
 * Ter as variáveis preenchidas não prova nada: a instância pode
 * estar desconectada do aparelho. Só uma chamada de verdade diz.
 */
export async function verificarConexao() {
  if (!zapiConfigurado()) return { conectado: false, motivo: "nao_configurado" };

  try {
    const url = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCIA}/token/${process.env.ZAPI_TOKEN}/status`;
    const cabecalhos = {};
    if (process.env.ZAPI_CLIENT_TOKEN) {
      cabecalhos["Client-Token"] = process.env.ZAPI_CLIENT_TOKEN;
    }

    const r = await fetch(url, { headers: cabecalhos, signal: AbortSignal.timeout(8000) });
    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      return { conectado: false, motivo: JSON.stringify(d).slice(0, 200) };
    }
    // A Z-API responde { connected: true, smartphoneConnected: true, ... }
    return {
      conectado: Boolean(d?.connected),
      celularOnline: Boolean(d?.smartphoneConnected),
      motivo: d?.error || null,
    };
  } catch (e) {
    return { conectado: false, motivo: String(e?.message || e).slice(0, 150) };
  }
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
/*
 * Espaçamento entre disparos automáticos.
 * Rajada de mensagens no mesmo segundo é o padrão que derruba número.
 * Mas o intervalo não pode ser longo: numa campanha com 56 atendimentos,
 * três minutos entre cada um levaria quase três horas para escoar.
 * Por isso o controle é em SEGUNDOS, com um teto diário como proteção.
 */
const SEGUNDOS_ENTRE_DISPAROS = Number(process.env.WHATSAPP_SEGUNDOS_ENTRE_DISPAROS || 25);
const MAXIMO_POR_DIA = Number(process.env.WHATSAPP_MAXIMO_POR_DIA || 150);

async function podeDispararAgora(clienteId) {
  await garantirTabelas();

  // Teto diário: protege o número mesmo em campanha grande
  const { rows: hoje } = await sql`
    SELECT COUNT(*)::int AS total FROM mensagens_wa
    WHERE cliente_id = ${clienteId} AND direcao = 'out'
      AND criado_em > NOW() - INTERVAL '24 hours';
  `;
  if ((hoje[0]?.total ?? 0) >= MAXIMO_POR_DIA) {
    return { pode: false, motivo: "limite_diario_atingido" };
  }

  const { rows } = await sql`
    SELECT criado_em FROM mensagens_wa
    WHERE cliente_id = ${clienteId} AND direcao = 'out'
    ORDER BY criado_em DESC LIMIT 1;
  `;
  if (!rows.length) return { pode: true };

  const segundos = (Date.now() - new Date(rows[0].criado_em).getTime()) / 1000;
  return segundos >= SEGUNDOS_ENTRE_DISPAROS
    ? { pode: true }
    : { pode: false, motivo: "aguardando_intervalo" };
}

export async function enviarTemplate({
  clienteId,
  precoConversa,
  telefone,
  nome,
  ignorarIntervalo = false,
}) {
  const canal = canalAtivo();
  if (!canal) return { ok: false, motivo: "whatsapp_nao_configurado" };

  // Segura o disparo se o anterior foi há pouco tempo.
  // O envio em lote traz o próprio espaçamento, então pode pular.
  if (!ignorarIntervalo) {
    const liberado = await podeDispararAgora(clienteId);
    if (!liberado.pode) return { ok: false, motivo: liberado.motivo };
  }

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
export async function enviarTexto({ clienteId, precoConversa, telefone, texto, ritmo = null }) {
  const canal = canalAtivo();
  if (!canal) return { ok: false, motivo: "whatsapp_nao_configurado" };

  // ---- Caminho Z-API: texto livre a qualquer momento ----
  if (canal === "zapi") {
    const { ok, dados } = await enviarPelaZapi(telefone, texto, ritmo);
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
