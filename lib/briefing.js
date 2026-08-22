import { garantirTabelas, sql } from "@/lib/db";

/*
 * ============================================================
 * RESUMO PRÉ-REUNIÃO ("a cola do Eric")
 * ============================================================
 * Junta tudo que existe sobre o lead — a ligação (resumo +
 * transcrição) e a conversa inteira do WhatsApp — e pede à IA
 * um resumo curto, feito para ser lido 2 minutos antes da
 * reunião. A ideia: o Eric entra na chamada sabendo quem é a
 * pessoa, o que ela quer e por onde começar, sem precisar
 * reler conversa nenhuma.
 *
 * Gerado automaticamente quando a Lara marca reunião pelo
 * WhatsApp, e sob demanda pelo botão na página Reuniões
 * (cobre as reuniões marcadas por telefone).
 */

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

/** Monta o material bruto e pede o resumo à IA. Devolve texto ou null. */
export async function gerarBriefing({ clienteId, telefone }) {
  if (!process.env.ANTHROPIC_API_KEY || !telefone) return null;

  await garantirTabelas();

  const { rows: lig } = await sql`
    SELECT resumo, transcript, duracao_ms::int AS duracao_ms, criado_em
    FROM ligacoes
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone} AND sucesso = TRUE
    ORDER BY criado_em DESC LIMIT 1;
  `;
  const { rows: msgs } = await sql`
    SELECT direcao, texto FROM mensagens_wa
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone}
    ORDER BY criado_em ASC LIMIT 80;
  `;
  const { rows: contato } = await sql`
    SELECT nome, empresa FROM contatos
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone} LIMIT 1;
  `;

  const conversaWa = msgs
    .filter((m) => !String(m.texto).startsWith("[follow-up"))
    .map((m) => `${m.direcao === "in" ? "Lead" : "Lara"}: ${m.texto}`)
    .join("\n");

  // Sem material nenhum não há o que resumir
  if (!lig[0] && !conversaWa) return null;

  const material = `LEAD: ${contato[0]?.nome || "(sem nome no cadastro)"}${
    contato[0]?.empresa ? ` — ${contato[0].empresa}` : ""
  }

${
  lig[0]
    ? `LIGAÇÃO (durou ${Math.round((lig[0].duracao_ms || 0) / 1000)}s):
Resumo: ${lig[0].resumo || "sem resumo"}
Transcrição: ${String(lig[0].transcript || "").slice(0, 2500)}`
    : "Não houve ligação atendida com este lead."
}

CONVERSA NO WHATSAPP:
${conversaWa || "(sem conversa no WhatsApp)"}`;

  const sistema = `Você prepara o Eric, consultor de crédito da Ademicon, para uma reunião de 15 minutos com um lead. Ele vai ler seu texto 2 minutos antes de entrar na chamada, no celular.

Escreva EXATAMENTE neste formato, em português, sem markdown, sem asteriscos:

QUEM É: uma linha — nome, empresa e o que ela faz (se souber).
O QUE ELE QUER: 1 a 3 linhas — a necessidade ou interesse concreto que apareceu (obra, máquina, dívida, capital, prazo). Se nada apareceu, diga "ainda não revelou necessidade concreta" e o que chegou mais perto.
RECEIOS: 1 a 2 linhas — objeções, desconfianças ou dúvidas que o lead levantou (ex.: achou que era golpe, perguntou se é consórcio). Se não houve, escreva "nenhum registrado".
TEMPERATURA: uma linha — frio, morno ou quente, e por quê, em poucas palavras.
COMECE POR: 1 a 2 linhas — uma sugestão concreta de abertura da reunião, amarrada no que o lead disse. Nunca genérica.

Regras: só use o que está no material — NUNCA invente. Frases curtas. No máximo 12 linhas no total. Se o lead perguntou algo que ficou sem resposta boa, inclua em COMECE POR.`;

  try {
    const resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 500,
        system: sistema,
        messages: [{ role: "user", content: material }],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!resposta.ok) return null;

    const dados = await resposta.json();
    const texto = (dados.content ?? []).find((c) => c.type === "text")?.text?.trim();
    return texto || null;
  } catch (e) {
    console.error("briefing_erro:", e);
    return null;
  }
}

/** Gera e grava o resumo na reunião mais recente deste telefone. */
export async function gerarESalvarBriefing({ clienteId, telefone }) {
  const texto = await gerarBriefing({ clienteId, telefone });
  if (!texto) return null;

  await sql`
    UPDATE eventos SET briefing = ${texto}
    WHERE id = (
      SELECT id FROM eventos
      WHERE cliente_id = ${clienteId} AND telefone = ${telefone}
      ORDER BY criado_em DESC LIMIT 1
    );
  `;
  return texto;
}
