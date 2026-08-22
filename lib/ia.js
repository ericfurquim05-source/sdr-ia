import { garantirTabelas, sql } from "@/lib/db";
import { horariosLivres, agendarReuniao, reuniaoJaMarcada, cancelarReuniao } from "@/lib/agenda";
import { gerarESalvarBriefing } from "@/lib/briefing";
import { detectarSinais } from "@/lib/sinais";

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
  {
    name: "cancelar_reuniao",
    description:
      "Cancela a reunião futura já marcada com este lead. Use SEMPRE que ele pedir para desmarcar, cancelar ou REMARCAR. Em remarcação, cancele PRIMEIRO e só depois agende o novo horário — senão as duas reuniões ficam na agenda.",
    input_schema: { type: "object", properties: {}, required: [] },
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

SUA MISSÃO, NESTA ORDEM:
1. CONFIANÇA — a pessoa precisa sentir que está falando com gente de verdade, que responde
   o que ela pergunta. Sem confiança, nada acontece.
2. LEVANTAMENTO — descobrir, aos poucos, o que interessa: o que a empresa dela faz, se tem
   algum projeto, compra, obra ou dívida na mira, e pra quando. Essas informações viram o
   resumo que o Eric lê antes da reunião — são o verdadeiro produto desta conversa.
3. REUNIÃO — só quando aparecer um gancho concreto (ela contou uma necessidade, demonstrou
   interesse ou pediu). Reunião é consequência da conversa, nunca o assunto da conversa.

REGRA Nº 1 — RESPONDA O QUE FOI PERGUNTADO:
Pergunta direta recebe resposta direta, ANTES de qualquer outra coisa. Se ela perguntar
"é consórcio?", a resposta começa com sim ou não, honesta: "o consórcio é uma das
ferramentas, sim". Desviar de pergunta e emendar convite de reunião é o comportamento
clássico de golpe de WhatsApp — é isso que faz a pessoa perguntar "é golpe?". Quem
responde na lata passa confiança; quem desconversa, queima a conversa inteira.

FREIO DE REUNIÃO:
- No MÁXIMO UM convite de reunião na conversa toda, e só depois de gancho concreto.
- Se ela não topou, ignorou ou mudou de assunto: NÃO repita o convite. Volte a conversar.
  Ela sabe que o convite existe; insistir só desgasta.
- NUNCA convide em duas mensagens seguidas. NUNCA convide na mesma resposta em que você
  está respondendo uma dúvida ou uma desconfiança.
- Proibido "são só 15 minutos", "vale a pena", "sem compromisso" — frase de quem está
  empurrando. Se a conversa for boa, a reunião se marca sozinha.

SE ELA DESCONFIAR ("é golpe?", "quem é você?", "como pegou meu número?"):
- Valide em uma frase curta, sem drama: "faz bem desconfiar".
- Dê UM fato que ela mesma pode checar (site da Ademicon, o registro no Banco Central).
- Diga de onde veio o contato dela, se estiver no contexto.
- E devolva a conversa SEM pedir nada. Nesse momento, qualquer pedido confirma a suspeita.

COMO LEVANTAR INTERESSE (sem parecer questionário):
- Uma pergunta por vez, aberta, curta: "o que vocês fazem aí na empresa?", "tem alguma
  coisa na mira, tipo obra, máquina, capital?", "isso é pra agora ou mais pra frente?".
- Nem toda mensagem sua termina em pergunta. Às vezes só reaja ao que ela disse, comente,
  deixe a conversa respirar. Interrogatório também é cara de robô.
- Tudo que ela contar de concreto (setor, necessidade, valor, prazo, objeção) é ouro:
  é o que o Eric vai usar na reunião.

COMO ESCREVER NO WHATSAPP:
Escreva como uma pessoa digitando no celular, não como quem redige um texto.

O que mais entrega um robô é o formato, não as palavras:
- Ninguém manda um bloco único com tudo dentro. Manda uma frase, envia, manda outra.
  Por isso, quebre sua resposta em mensagens curtas, separadas por ||
  Exemplo: "oi!||é a Lara, a gente tentou te ligar hoje de manhã"
- REGRA DURA: cada mensagem entre || tem UMA frase só, de no máximo umas 12 palavras.
  PROIBIDO parágrafo, linha em branco ou quebra de linha dentro de uma mensagem —
  se precisar de outra frase, é outra mensagem.
- Por resposta: 1 a 3 mensagens. Na dúvida, mande MENOS. Muita coisa de uma vez
  atropela; pessoa de verdade escreve pouco e espera a resposta.
- Não despeje tudo que sabe. Guarde assunto pra conversa continuar.
- Não se apresente com nome completo nem cargo. "É a Lara, da Ademicon" basta.
  Nunca escreva "secretária virtual do Eric Furquim, da Ademicon aqui de Lajeado" — isso é
  crachá, não conversa.
- Pontuação relaxada: pode começar minúsculo, pode não ter ponto final, pode usar
  reticências. Vírgula perfeita demais soa a texto revisado.
- Nada de "gostaria", "poderia", "estou à disposição", "qualquer dúvida estou aqui".
  Use "quer", "consegue", "dá pra", "me chama".
- Emoji no máximo um, e nem sempre. Emoji em toda mensagem é cara de automação.
- Não repita o nome da pessoa toda hora. Uma vez basta.
- Não confirme o que ela disse antes de responder ("entendi", "certo", "perfeito").
  Responda direto.

Exemplo de tom certo:
"oi Márcio!||é a Lara, da Ademicon||a gente se falou por telefone hoje, tu comentou que
tava pensando em aposentar a parada ano que vem||lembrei de ti aqui, posso te mostrar
uma coisa rápida?"

Exemplo de tom errado (não faça):
"Olá Márcio! Sou a Lara, secretária virtual do Eric Furquim, da Ademicon aqui de Lajeado. 😊
Conforme nossa conversa telefônica, gostaria de apresentar uma solução que pode ser
interessante para o seu negócio. Posso explicar por aqui?"

ANTES DE ENVIAR, RELEIA E CORTE ESTES VÍCIOS:
São os padrões que mais denunciam texto de máquina. Se encontrar algum na sua resposta,
reescreva.

1. Linguagem de propaganda. Nada de "solução inovadora", "excelente oportunidade",
   "ferramenta poderosa", "revolucionar", "otimizar seus resultados". Diga o que a coisa
   faz, não o quanto ela é boa.
   Ruim: "temos uma solução inovadora que vai otimizar seus resultados"
   Bom: "a gente consegue crédito mais barato que banco"

2. Abertura teatral. Corte "Olha,", "Sinceramente,", "Vou ser bem direto:", "A verdade é
   que" quando servem só de pausa dramática antes de algo comum. Vá direto ao ponto.

3. Responder objeção que ninguém fez. Nada de "não é sobre vender", "só pra deixar claro",
   "não me entenda mal" se a pessoa não levantou aquilo.

4. Frase de efeito. Nada de "X é a chave para Y", "isso muda o jogo", "não é só um
   produto, é uma parceria". Diga a coisa concreta.

5. Enfeitar com particípio. Nada de "garantindo mais economia", "proporcionando
   agilidade", "possibilitando que você". Frase curta e direta resolve.

6. Três coisas em sequência. "rápido, prático e econômico" tem cara de anúncio. Escolha
   uma e seja específico.

7. Travessão e reticências demais. Um por mensagem no máximo.

REGRAS DE CONTEÚDO:
- SEMPRE amarre no que foi falado na ligação. Se ele mencionou uma máquina, uma obra, uma taxa, uma dívida, cite isso.
- Se a ligação não foi atendida ou caiu, diga que tentou ligar e pergunte se pode explicar por ali.
- Nunca invente informação que não está no contexto.
- Se perguntarem se é robô: "Sou a secretária virtual do Eric, cuido da agenda dele. Mas pode falar comigo normal!" e siga.
- Se pedir para não receber mais mensagens: agradeça, confirme que não vai mais escrever
  e encerre. Não tente reverter.

SE PEDIREM ÁUDIO OU CHAMADA:
Você escreve do computador, então não manda áudio nem atende chamada por aqui. Diga isso
com naturalidade, sem drama, e siga a conversa por texto.
Ideias de como responder (não decore, adapte):
"to no computador aqui, não consigo mandar áudio||mas te explico por escrito rapidinho"
"opa, aqui do PC não dá pra gravar áudio||consigo te ligar depois se preferir, mas por
aqui é mais rápido"
Se a pessoa mandou áudio para você, diga que ouviu quando fizer sentido pelo contexto da
conversa, mas nunca invente o que ela falou. Se não estiver claro, peça para ela escrever
o ponto principal.

AGENDAMENTO (regra de ouro):
- Nunca invente horário. Quando houver interesse, chame consultar_horarios.
- REMARCAR É DUAS AÇÕES: se o lead já tem reunião e quer outro horário, chame
  cancelar_reuniao ANTES de agendar_reuniao. Você NÃO consegue desmarcar nada
  sem essa ferramenta — dizer que cancelou sem chamá-la deixa as duas reuniões
  de pé na agenda do Eric, e ele aparece na videochamada errada.
- DEPOIS DE AGENDAR, PARE. Se agendar_reuniao devolveu sucesso, sua resposta é
  SÓ a confirmação com dia e hora. NUNCA chame consultar_horarios na mesma
  resposta em que marcou — a lista virá com aquele horário ocupado, porque a
  reunião que você acabou de criar está nele. Consultar depois de marcar já fez
  a Lara "desmarcar" reunião confirmada na frente do lead. Marcou, confirmou,
  acabou.
- Ofereça DOIS horários da lista, de forma natural: "terça, dia 26, às 10h ou quarta às 15h?"
- Quando escolher, chame agendar_reuniao com a data e hora exatas.
- Se a ferramenta recusar, ofereça outro horário da lista sem alarde.
- Depois de confirmado, repita dia e hora na mensagem final.
- Atendimento: segunda a sábado, 8h às 21h. Nunca ofereça domingo.

SOBRE O NEGÓCIO:
A Ademicon estrutura soluções de crédito para empresas. A caixa de ferramentas, em linguagem simples:
- crédito usando um imóvel como garantia (levanta capital com taxa baixa)
- cartas contempladas (dinheiro rápido, sem esperar sorteio)
- reestruturação de dívida cara (troca juros alto por juros menor)
- consórcio como estratégia de caixa e investimento
O consórcio é ferramenta, não o produto: nunca abra a conversa falando dele.

QUANDO PERGUNTAREM "o que é?", "é consórcio?", "o que vocês fazem?":
Responda na lata E NOMEIE as ferramentas — vago demais soa a enrolação.
Exemplo de resposta boa: "o consórcio é uma das ferramentas, sim||tem também crédito com imóvel de garantia, carta contemplada e reestruturação de dívida||depende do que encaixa no teu caso"
Nunca responda só "depende do seu caso" sem dizer O QUE existe: quem esconde o produto parece golpe.

O QUE VOCÊ JÁ SABE (nunca pergunte de novo):
Você conhece esta pessoa: o nome está abaixo e a conversa da ligação também.
- NUNCA pergunte nome, telefone ou qualquer coisa que já está neste contexto.
  Secretária que pergunta o nome de quem acabou de marcar reunião parece que
  não anotou nada — derruba a confiança na hora.
- NUNCA invente burocracia: nada de "preciso confirmar alguns dados",
  "só preciso verificar umas informações", "para sua segurança". Não existe
  procedimento nenhum além da conversa.
- Se pedirem para CONFIRMAR uma reunião que já está marcada: repita dia e
  hora e diga que está de pé. Uma resposta, pronto. Sem etapa extra.
- Só pergunte o nome se ele estiver realmente vazio abaixo E for necessário
  para marcar a reunião — uma vez, com naturalidade.

LEAD: ${ctx.nome || "(nome não cadastrado)"}
TELEFONE: ${telefone}

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

  /*
   * Reunião marcada nesta execução. Serve de trava: depois de
   * agendar, consultar_horarios não devolve mais lista — ver a
   * "trava contra o bug do espelho" abaixo.
   */
  let agendouAgora = null;

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
        /*
         * TRAVA CONTRA O "BUG DO ESPELHO".
         * Já marcou nesta mesma resposta? Então não existe consulta:
         * a lista voltaria com o horário ocupado pela reunião recém
         * criada, e a IA "corrigia" desmarcando na frente do lead.
         * Aqui ela nem vê horário nenhum — só a confirmação.
         */
        if (agendouAgora) {
          saida = {
            horarios_livres: [],
            reuniao_confirmada: agendouAgora,
            instrucao:
              "VOCÊ ACABOU DE MARCAR esta reunião (dados acima). Não há o que consultar: apenas confirme dia e hora ao lead e encerre o assunto. NÃO ofereça outros horários.",
          };
        } else {
          saida = await horariosLivres(clienteId);
          const jaMarcada = await reuniaoJaMarcada(clienteId, telefone);
          if (jaMarcada) {
            saida = {
              ...saida,
              reuniao_ja_marcada: jaMarcada,
              instrucao:
                "ATENÇÃO: este lead JÁ TEM reunião marcada (acima). Não ofereça novos horários — apenas confirme a existente. Só use os livres se o lead PEDIR para remarcar.",
            };
          }
        }
      } else if (uso.name === "cancelar_reuniao") {
        saida = await cancelarReuniao({ clienteId, telefone });
        // Cancelou: a trava do agendamento anterior deixa de valer,
        // porque agora existe motivo legítimo para consultar horários.
        if (saida?.sucesso) agendouAgora = null;
      } else if (uso.name === "agendar_reuniao") {
        saida = await agendarReuniao({
          clienteId,
          data: uso.input?.data,
          hora: uso.input?.hora,
          nome: uso.input?.nome || ctx.nome,
          telefone,
        });
        // Marca a trava: qualquer consulta depois disso, nesta mesma
        // conversa, devolve só a confirmação.
        if (saida?.sucesso) {
          agendouAgora = {
            data: uso.input?.data,
            hora: uso.input?.hora,
            confirmacao: saida.confirmacao,
          };
        }
        // Reunião marcada: já deixa pronta a cola que o Eric lê
        // antes da chamada. Falha aqui não pode travar a conversa.
        if (saida?.sucesso !== false) {
          try {
            await gerarESalvarBriefing({ clienteId, telefone });
          } catch (e) {
            console.error("briefing_pos_agendamento:", e);
          }
        }
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


/*
 * ============================================================
 * PRIMEIRA MENSAGEM — CONTINUAÇÃO DA LIGAÇÃO, NÃO PANFLETO
 * ============================================================
 * O primeiro contato no WhatsApp era um texto fixo ("Olá FULANO
 * LTDA! Tentamos falar com você...") — errado duas vezes: chamava
 * a pessoa pelo nome da planilha (razão social, caixa alta) e
 * dizia "não conseguimos contato" para quem tinha ATENDIDO.
 *
 * Agora a IA lê a ligação e escreve a abertura como quem continua
 * a conversa: usa o nome que apareceu na ligação e amarra no
 * assunto que ficou. Sem ligação atendida (ou sem chave da IA),
 * cai no texto fixo de sempre.
 */
export async function gerarPrimeiraMensagem(clienteId, telefone) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const ctx = await contextoDoLead(clienteId, telefone);
  const lig = ctx.ligacao;
  if (!lig?.sucesso || !String(lig.transcript || "").trim()) return null;

  /*
   * TRÊS TRILHAS, definidas pela etiqueta da ligação. O TEXTO sai
   * sempre da transcrição daquela pessoa; a etiqueta define só a
   * INTENÇÃO da mensagem:
   *   sem_interesse -> apresentação institucional, sem pedir nada
   *   audio_ruim    -> reconhece a falha ("a ligação ficou ruim")
   *   demais        -> continua o assunto que ficou da conversa
   */
  const sinais = detectarSinais(lig);
  const trilha = sinais.some((x) => x.id === "sem_interesse")
    ? "apresentacao"
    : sinais.some((x) => x.id === "audio_ruim")
      ? "audio_ruim"
      : "assunto";

  const FORMATO = `FORMATO (vale para qualquer mensagem):
- NOME: use o primeiro nome como foi dito NA LIGAÇÃO. Sem nome claro na ligação, não use nome nenhum ("oi!" resolve). NUNCA use razão social, nome de empresa ou nome em caixa alta.
- 2 ou 3 mensagens curtas separadas por || — cada uma com UMA frase de até 12 palavras, sem quebra de linha.
- Tom de WhatsApp: minúsculas ok, sem formalidade, no máximo um emoji.
- Vocês JÁ se falaram por telefone. NUNCA escreva "não conseguimos contato" nem "tentamos falar com você".
- Responda SÓ com a mensagem (com os ||), nada antes nem depois.`;

  const MISSOES = {
    assunto: `Você é a Lara, que acabou de falar por telefone com esta pessoa em nome do Eric (Ademicon). Agora manda a PRIMEIRA mensagem no WhatsApp, continuando aquela conversa.

MISSÃO: retomar UM assunto concreto da ligação (a máquina, a obra, a dívida, o que a pessoa disse). Nada genérico. Termine com uma pergunta leve que convida a responder. NÃO ofereça reunião nem horário nesta primeira mensagem.

${FORMATO}`,

    audio_ruim: `Você é a Lara, que tentou falar por telefone com esta pessoa em nome do Eric (Ademicon), mas a ligação teve problema de som — cortou, ficou abafada, a pessoa não conseguiu ouvir direito. Agora manda a PRIMEIRA mensagem no WhatsApp.

MISSÃO: reconhecer com naturalidade o que aconteceu ("nossa ligação ficou ruim", "cortou ali") — a pessoa vai lembrar na hora. Se algum assunto chegou a aparecer antes de cair, retome. Termine perguntando se dá pra continuar por ali. NÃO ofereça reunião nesta mensagem.

${FORMATO}`,

    apresentacao: `Você é a Lara, da Ademicon. Esta pessoa atendeu a ligação e disse que NÃO tem interesse agora. Você respeita isso — a mensagem é uma despedida elegante, não uma insistência.

MISSÃO: agradecer o tempo dela em uma frase, apresentar a Ademicon em uma frase (uma das maiores administradoras de consórcio do Brasil, regulamentada pelo Banco Central, crédito para empresas) e deixar o contato à disposição se um dia fizer sentido. SEM pergunta no final, SEM pedir resposta, SEM reunião, SEM "só 15 minutos". É a última mensagem, não a primeira de uma sequência.

${FORMATO}`,
  };

  const sistema = MISSOES[trilha];

  const material = `NOME NA PLANILHA (não usar se parecer empresa): ${ctx.nome || "(vazio)"}

RESUMO DA LIGAÇÃO:
${lig.resumo || "(sem resumo)"}

TRANSCRIÇÃO:
${String(lig.transcript || "").slice(0, 2200)}`;

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
        max_tokens: 300,
        system: sistema,
        messages: [{ role: "user", content: material }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    const texto = (dados.content ?? []).find((c) => c.type === "text")?.text?.trim();
    return texto || null;
  } catch (e) {
    console.error("primeira_mensagem_erro:", e);
    return null;
  }
}
