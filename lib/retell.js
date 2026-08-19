/*
 * ============================================================
 * INTEGRAÇÃO COM A RETELL AI — DISPARO DE LIGAÇÃO
 * ============================================================
 * Centraliza a montagem do número (prefixo do tronco SIP) e a
 * chamada à API create-phone-call. Usada pelo disparo inicial,
 * pelo webhook (cadeia) e pelo processador manual/cron.
 */

// Monta o número final no formato que o tronco espera.
// Ex.: prefixo 968655 + 51980554326 = 96865551980554326
export function montarNumeroDestino(local) {
  const prefixo = (process.env.RETELL_PREFIXO_DISCAGEM || "").replace(/\D/g, "");
  if (prefixo) return prefixo + local; // discagem via tronco SIP
  return "+55" + local;                // padrão E.164 quando não há prefixo
}

export function agentIdPorTipo(tipoAgente) {
  return tipoAgente === "quente"
    ? process.env.RETELL_AGENT_QUENTE_ID
    : process.env.RETELL_AGENT_FRIO_ID;
}

/**
 * Dispara uma ligação na Retell para um contato da fila.
 * Retorna { ok, callId, detalhe }.
 */
export async function dispararLigacao(contato) {
  const resposta = await fetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_number: process.env.RETELL_FROM_NUMBER,
      to_number: montarNumeroDestino(contato.telefone),
      override_agent_id: agentIdPorTipo(contato.agente),
      // "Keep raw input": permite discar com o prefixo do tronco SIP
      ignore_e164_validation: true,
      // Disponível no prompt do agente como {{nome}}
      retell_llm_dynamic_variables: { nome: contato.nome || "" },
      // Volta no webhook em call.metadata — é como reencontramos o contato
      metadata: { contato_id: contato.id },
    }),
  });

  if (!resposta.ok) {
    const detalhe = (await resposta.text()).slice(0, 300);
    return { ok: false, callId: null, detalhe };
  }

  const dados = await resposta.json();
  return { ok: true, callId: dados.call_id ?? null, detalhe: null };
}
