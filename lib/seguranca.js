import crypto from "crypto";

/*
 * ============================================================
 * SEGURANÇA DAS ROTAS PÚBLICAS (WEBHOOKS)
 * ============================================================
 * Webhooks precisam ficar abertos na internet — a Retell, a
 * Z-API e a Meta chamam de fora. Mas "aberto" não pode ser
 * "qualquer um": sem validação, um curioso que descubra a URL
 * forja eventos, cobra o saldo dos clientes e dispara WhatsApp
 * pelo nosso número.
 *
 * Cada origem tem seu jeito de provar quem é:
 *   Retell → assina cada evento (x-retell-signature)
 *   Z-API  → não assina; usamos um segredo na URL do webhook
 *   Agenda → cabeçalho secreto configurado na custom function
 *   Meta   → assina com o App Secret (x-hub-signature-256)
 *
 * Válvula de escape: WEBHOOKS_SEM_ASSINATURA=1 desliga TODAS as
 * validações de uma vez. Só para diagnóstico, nunca em produção.
 * ============================================================
 */

/** Comparação à prova de timing — nunca use === para segredos. */
export function compararSeguro(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Chave-geral de emergência: desliga as validações para diagnóstico. */
export function validacaoDesligada() {
  return process.env.WEBHOOKS_SEM_ASSINATURA === "1";
}

/*
 * ------------------------------------------------------------
 * RETELL — x-retell-signature: "v={timestamp_ms},d={hex}"
 * ------------------------------------------------------------
 * O digest é HMAC-SHA256 do corpo BRUTO concatenado com o
 * timestamp, usando a API key como chave (a mesma RETELL_API_KEY
 * que já usamos para discar — no painel, é a chave com o selo
 * "webhook"). Janela de 5 minutos contra replay.
 */
export function assinaturaRetellValida(corpoBruto, cabecalho) {
  if (validacaoDesligada()) return { ok: true, motivo: "validacao_desligada" };

  const chave = process.env.RETELL_API_KEY;
  // Sem chave configurada não há como validar — aceita e avisa no log,
  // porque rejeitar aqui pararia a fila de discagem inteira.
  if (!chave) {
    console.warn("retell_webhook: RETELL_API_KEY ausente, evento aceito SEM validação");
    return { ok: true, motivo: "sem_chave" };
  }

  const combinado = /v=(\d+),d=([a-f0-9]+)/i.exec(String(cabecalho ?? ""));
  if (!combinado) return { ok: false, motivo: "cabecalho_ausente_ou_invalido" };

  const [, timestamp, digest] = combinado;

  // Evento velho demais (ou relógio muito adiantado): provável replay
  const idadeMs = Math.abs(Date.now() - Number(timestamp));
  if (idadeMs > 5 * 60 * 1000) return { ok: false, motivo: "fora_da_janela_5min" };

  const esperado = crypto
    .createHmac("sha256", chave)
    .update(corpoBruto + timestamp)
    .digest("hex");

  return compararSeguro(digest, esperado)
    ? { ok: true, motivo: null }
    : { ok: false, motivo: "assinatura_nao_confere" };
}

/*
 * ------------------------------------------------------------
 * Z-API — segredo na URL do webhook
 * ------------------------------------------------------------
 * A Z-API não assina os eventos. A defesa é um segredo que só
 * nós e ela conhecemos, embutido na URL configurada no painel:
 *   https://SEU-SITE/api/whatsapp/zapi?segredo=VALOR
 * Enquanto ZAPI_WEBHOOK_SEGREDO estiver vazio, a rota aceita
 * tudo (compatível com a configuração atual) — preencha e
 * atualize a URL no painel para fechar a porta.
 */
export function segredoZapiConfere(request) {
  if (validacaoDesligada()) return true;

  const esperado = process.env.ZAPI_WEBHOOK_SEGREDO;
  if (!esperado) return true; // ainda não configurado: mantém funcionando

  const recebido = new URL(request.url).searchParams.get("segredo");
  return compararSeguro(recebido, esperado);
}

/*
 * ------------------------------------------------------------
 * AGENDA — cabeçalho secreto vindo da custom function da Retell
 * ------------------------------------------------------------
 * As rotas /api/agenda/* são chamadas pela Retell durante a
 * ligação. No diálogo da custom function há um campo Headers:
 * adicione "x-agenda-segredo" com o mesmo valor de AGENDA_SEGREDO.
 * Enquanto a variável estiver vazia, a rota aceita tudo.
 */
export function segredoAgendaConfere(request) {
  if (validacaoDesligada()) return true;

  const esperado = process.env.AGENDA_SEGREDO;
  if (!esperado) return true; // ainda não configurado: mantém funcionando

  const recebido = request.headers.get("x-agenda-segredo");
  return compararSeguro(recebido, esperado);
}

/*
 * ------------------------------------------------------------
 * META — x-hub-signature-256: "sha256={hex}"
 * ------------------------------------------------------------
 * HMAC-SHA256 do corpo bruto com o App Secret do aplicativo
 * (Meta for Developers → Configurações → Básico). Enquanto
 * META_APP_SECRET estiver vazio, a rota aceita tudo — o canal
 * Meta está dormente hoje, mas a porta já fica pronta.
 */
export function assinaturaMetaValida(corpoBruto, cabecalho) {
  if (validacaoDesligada()) return true;

  const chave = process.env.META_APP_SECRET;
  if (!chave) return true; // canal dormente: valida quando configurar

  const recebido = String(cabecalho ?? "").replace(/^sha256=/, "");
  const esperado = crypto.createHmac("sha256", chave).update(corpoBruto).digest("hex");
  return compararSeguro(recebido, esperado);
}
