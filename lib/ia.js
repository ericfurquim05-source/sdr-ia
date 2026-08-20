import { garantirTabelas, sql } from "@/lib/db";
import { horariosLivres, agendarReuniao } from "@/lib/agenda";

/*
 * ============================================================
 * LARA NO WHATSAPP — CONTINUAÇÃO DA LIGAÇÃO
 * ============================================================
 * A mesma Lara que ligou continua a conversa por escrito, com o
 * contexto do que foi falado ao telefone (resumo + transcrição).
 *
 * Ela tem as MESMAS ferramentas da ligação:
 *   consultar_horarios  -> horários realmente livres
 *   agendar_reuniao     -> marca de verdade, validando a agenda
 *
 * Variáveis: ANTHROPIC_API_KEY e WHATSAPP_AUTORESPOSTA=1
 */

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export function autorespostaLigada() {
  return (
    Boolean(process.env.ANTHROPIC_API_KEY) &&
    String(process.env.WHATSAPP_AUTORESPOSTA || "") === "1"
  );
}

/** Junta tudo que a Lara sabe sobre este lead: ligação + conversa. */
export async function contextoDoLead(clienteId, telefone) {
  await garantirTabelas();

  const { rows: lig } = await sql`
    SELECT resumo, transcript, sucesso, motivo, criado_em FROM ligacoes
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone}
    ORDER BY criado_em DESC LIMIT 1;
  `;
  const { rows: msgs } = await sql`
    SELECT direcao, texto FROM mensagens_wa
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone}
    ORDER BY criado_em DESC LIMIT 14;
  `;
  const { rows: contato } = await sql`
    SELECT nome FROM contatos
    WHERE cliente_id = ${clienteId} AND telefone = ${telefone} LIMIT 1;
  `;

  return {
    nome: contato[0]?.nome || "",
    ligacao: lig[0] ?? null,
    mensagens: msgs.reverse(),
  };
}

const FERRAMENTAS = [
  {
    name: "consultar_horarios",
    description:
      "Consulta os horários realmente livres na agenda do Eric (segunda a sábado, 08:00 às 21:00). Use SEMPRE antes de oferecer qualquer horário ao lead. Nunca invente horários.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "agendar_reuniao",
    description:
      "Confirma a videochamada de 15 minutos no horário escolhido pelo lead. Use somente horários retornados por consultar_horarios.",
    input_schema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data no formato AAAA-MM-DD" },
        hora: { type: "string", description: "Hora no formato HH:MM em 24 horas" },
        nome: { type: "string", description: "Primeiro nome do lead" },
      },
      required: ["data", "hora"],
    },
  },
];

function instrucoes(ctx, telefone) {
  const blocoLigacao = ctx.ligacao
    ? `RESUMO DA LIGAÇÃO (${ctx.ligacao.sucesso ? "atendida" : "não atendida"}):
${ctx.ligacao.resumo ?? "sem resumo disponível"}

TRECHO DA TRANSCRIÇÃO:
${String(ctx.ligacao.transcript ?? "").slice(0, 1800)}`
    : "Ainda não houve ligação concluída com este lead.";

  return `Você é a Lara, secretária comercial do Eric Furquim, da Ademicon em Lajeado.
Você JÁ FALOU (ou tentou falar) com esta pessoa por telefone e agora continua a conversa pelo WhatsApp.

SEU OBJETIVO: retomar o assunto de onde parou e agendar uma videochamada de 15 minutos com o Eric.

COMO ESCREVER:
- Português brasileiro, tom de secretária real: cordial, direta, humana.
- Mensagens CURTAS: 1 a 3 frases. É WhatsApp, não e-mail.
- Use "tu", "tá", "pra", "a gente". Emoji só ocasionalmente, no máximo um.
- Nunca escreva textão nem lista de produtos.

REGRAS DE CONTEÚDO:
- SEMPRE amarre no que foi falado na ligação. Se ele mencionou uma máquina, uma obra, uma taxa, uma dívida, cite isso.
- Se a ligação não foi atendida ou caiu, diga que tentou ligar e pergunte se pode explicar por ali.
- Nunca invente informação que não está no contexto.
- Se perguntarem se é robô: "Sou a secretária virtual do Eric, cuido da agenda dele. Mas pode falar comigo normal!" e siga.
- Se pedir para não receber mais mensagens: agradeça e encerre, sem insistir.

AGENDAMENTO (regra de ouro):
- Nunca invente horário. Quando houver interesse, chame consultar_horarios.
- Ofereça DOIS horários da lista, de forma natural: "terça, dia 26, às 10h ou quarta às 15h?"
- Quando escolher, chame agendar_reuniao com a data e hora exatas.
- Se a ferramenta recusar, ofereça outro horário da lista sem alarde.
- Depois de confirmado, repita dia e hora na mensagem final.
- Atendimento: segunda a sábado, 8h às 21h. Nunca ofereça domingo.

SOBRE O NEGÓCIO:
A Ademicon estrutura soluções de crédito para empresas: crédito com garantia de imóvel (home equity), cartas contempladas para crédito imediato, reestruturação de dívidas caras e consórcio como estratégia de caixa. O consórcio é ferramenta, não o produto: nunca abra falando dele.

LEAD: ${ctx.nome || telefone}

${blocoLigacao}`;
}

async function chamarClaude(mensagens, sistema) {
  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 400,
      system: sistema,
      tools: FERRAMENTAS,
      messages: mensagens,
    }),
  });
  if (!resposta.ok) return null;
  return await resposta.json();
}

/**
 * Gera a resposta da Lara para a última mensagem do lead,
 * executando as ferramentas de agenda quando ela pedir.
 */
export async function responderComoSdr({ clienteId, telefone }) {
  const ctx = await contextoDoLead(clienteId, telefone);
  const sistema = instrucoes(ctx, telefone);

  const mensagens = ctx.mensagens.map((m) => ({
    role: m.direcao === "in" ? "user" : "assistant",
    content: m.texto,
  }));
  if (mensagens.length === 0 || mensagens[mensagens.length - 1].role !== "user") {
    mensagens.push({ role: "user", content: "(sem resposta ainda)" });
  }

  // Até 3 rodadas: consultar horários -> agendar -> responder
  for (let volta = 0; volta < 3; volta++) {
    const dados = await chamarClaude(mensagens, sistema);
    if (!dados) return null;

    const usos = (dados.content ?? []).filter((c) => c.type === "tool_use");

    if (usos.length === 0) {
      const texto = (dados.content ?? []).find((c) => c.type === "text")?.text?.trim();
      return texto || null;
    }

    mensagens.push({ role: "assistant", content: dados.content });
    const resultados = [];

    for (const uso of usos) {
      let saida;
      if (uso.name === "consultar_horarios") {
        saida = await horariosLivres(clienteId);
      } else if (uso.name === "agendar_reuniao") {
        saida = await agendarReuniao({
          clienteId,
          data: uso.input?.data,
          hora: uso.input?.hora,
          nome: uso.input?.nome || ctx.nome,
          telefone,
        });
      } else {
        saida = { erro: "ferramenta_desconhecida" };
      }
      resultados.push({
        type: "tool_result",
        tool_use_id: uso.id,
        content: JSON.stringify(saida),
      });
    }

    mensagens.push({ role: "user", content: resultados });
  }

  return null;
}
