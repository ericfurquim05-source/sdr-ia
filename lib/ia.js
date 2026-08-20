import { garantirTabelas, sql } from "@/lib/db";

/*
 * ============================================================
 * IA DE CONVERSA NO WHATSAPP — CONTEXTO OMNICHANNEL
 * ============================================================
 * Quando o lead responde no WhatsApp, esta função monta o
 * contexto (resumo + transcrição da última ligação + histórico
 * de mensagens) e gera a próxima resposta com a API da Anthropic.
 *
 * Variáveis: ANTHROPIC_API_KEY e WHATSAPP_AUTORESPOSTA=1
 */

export function autorespostaLigada() {
  return Boolean(process.env.ANTHROPIC_API_KEY) &&
    String(process.env.WHATSAPP_AUTORESPOSTA || "") === "1";
}

/** Junta o que a IA sabe sobre este lead: ligação + conversa. */
export async function contextoDoLead(clienteId, telefone) {
  await garantirTabelas();

  const { rows: lig } = await sql`
    SELECT resumo, transcript, sucesso, criado_em FROM ligacoes
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone}
    ORDER BY criado_em DESC LIMIT 1;
  `;
  const { rows: msgs } = await sql`
    SELECT direcao, texto FROM mensagens_wa
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone}
    ORDER BY criado_em DESC LIMIT 12;
  `;
  const { rows: contato } = await sql`
    SELECT nome FROM contatos
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone} LIMIT 1;
  `;

  return {
    nome: contato[0]?.nome || "",
    ligacao: lig[0] ?? null,
    mensagens: msgs.reverse(), // ordem cronológica
  };
}

/** Gera a resposta do SDR virtual para a última mensagem do lead. */
export async function responderComoSdr({ clienteId, telefone }) {
  const ctx = await contextoDoLead(clienteId, telefone);

  const historico = ctx.mensagens
    .map((m) => `${m.direcao === "in" ? "Lead" : "Você"}: ${m.texto}`)
    .join("\n");

  const blocoLigacao = ctx.ligacao
    ? `RESUMO DA ÚLTIMA LIGAÇÃO (${ctx.ligacao.sucesso ? "atendida" : "não atendida"}):\n${ctx.ligacao.resumo ?? "sem resumo"}\n\nTRECHO DA TRANSCRIÇÃO:\n${String(ctx.ligacao.transcript ?? "").slice(0, 1500)}`
    : "Ainda não houve ligação concluída com este lead.";

  const sistema = `Você é a Sofia, SDR (pré-vendas) brasileira que fala por WhatsApp.
Objetivo: dar sequência à conversa iniciada por telefone e conduzir o lead a agendar uma reunião.
Regras: responda em português do Brasil, em 1 a 3 frases curtas, tom cordial e direto, sem parecer robô.
Use o contexto da ligação quando existir (retome o assunto de onde parou). Nunca invente dados.
Se o lead pedir para parar, agradeça e encerre. Se demonstrar interesse, proponha dois horários de reunião em dias úteis.`;

  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 300,
      system: sistema,
      messages: [
        {
          role: "user",
          content: `LEAD: ${ctx.nome || telefone}\n\n${blocoLigacao}\n\nCONVERSA ATÉ AGORA:\n${historico}\n\nEscreva APENAS a próxima mensagem para o lead.`,
        },
      ],
    }),
  });

  if (!resposta.ok) return null;
  const dados = await resposta.json();
  const texto = dados?.content?.find((c) => c.type === "text")?.text?.trim();
  return texto || null;
}
