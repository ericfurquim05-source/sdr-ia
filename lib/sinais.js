/*
 * ============================================================
 * SINAIS DA CONVERSA — DETECÇÃO DE PALAVRAS-CHAVE
 * ============================================================
 * A função da Lara é marcar reunião. Quando ela NÃO fecha na hora,
 * a conversa quase sempre deixa uma pista: "projeto pra frente",
 * "me chama no zap", "liga semana que vem". Esses são os leads
 * mornos — os que mais valem follow-up.
 *
 * Aqui a gente varre a transcrição e o resumo e marca a ligação
 * com etiquetas coloridas, estilo post-it, na aba SDR IA.
 */

const REGRAS = [
  {
    id: "reuniao",
    rotulo: "Reunião aceita",
    prioridade: 1,
    cor: "#34D399",
    termos: [
      "pode marcar", "pode agendar", "fechado", "confirmado", "ta marcado",
      "combinado", "vamos fazer", "aceito", "manda o link", "manda o convite",
      "faz sentido sim", "pode ser sim", "tudo bem entao", "vamos conversar",
    ],
  },
  {
    id: "projeto",
    rotulo: "Projeto concreto",
    prioridade: 1,
    cor: "#A78BFA",
    termos: [
      // ditos reais: "máquina de picolé", "troca de equipamento"
      "maquina de", "equipamento", "veiculo novo", "caminhao", "frota",
      "imovel", "terreno", "galpao", "obra", "reforma", "ampliar",
      "ampliacao", "expandir", "expansao", "abrir outra", "nova loja",
      "comprar um", "comprar uma", "trocar o", "investimento",
    ],
  },
  {
    id: "sem_divida",
    rotulo: "Sem dívida (bom perfil)",
    prioridade: 1,
    cor: "#22D3EE",
    termos: [
      // perfil do Márcio: patrimônio limpo, planejando o futuro
      "nao tenho nada financiado", "nao temos nada", "nao tenho divida",
      "sem divida", "esta tudo em ordem", "ta tudo em ordem", "tudo controlado",
      "todo controle", "esta tudo tranquilo", "ta tudo tranquilo",
      "a gente tem caixa", "temos caixa", "capital proprio", "recurso proprio",
      "trabalho com o que a gente tem", "aposentar",
    ],
  },
  {
    id: "audio_ruim",
    rotulo: "Áudio ruim",
    // prioridade 4 = fora da lista de oportunidades. A ligação morreu por
    // falha técnica, não por interesse; a etiqueta fica só para medir
    // quantas chamadas o problema de som está custando.
    prioridade: 4,
    cor: "#475569",
    termos: [
      // problema técnico: a ligação morreu por som, não por desinteresse
      "nao estou conseguindo entender", "nao consigo entender",
      "nao consigo te entender", "nao estou te ouvindo", "nao to ouvindo",
      "esta muito abafado", "ta abafado", "ligacao esta ruim", "ligacao ta ruim",
      "esta cortando", "ta cortando", "falhou", "repita", "nao entendi nada",
      "nao estou entendendo", "muito perto do microfone", "liga de novo",
      "tentar ligar de novo",
    ],
  },
  {
    id: "futuro",
    rotulo: "Projeto futuro",
    prioridade: 2,
    cor: "#F59E0B",
    termos: [
      "mais pra frente", "mais para frente", "no futuro", "futuramente",
      "ano que vem", "proximo ano", "semestre", "mais adiante",
      "la na frente", "por enquanto nao", "ainda nao e o momento",
      "quem sabe depois", "curto prazo nao", "nesse momento nao",
      "quando o mercado", "se estabelecer", "estamos aguardando",
      "estamos planejando", "pretendo", "pretendemos", "futuramente sim",
    ],
  },
  {
    id: "whatsapp",
    rotulo: "Pediu WhatsApp",
    prioridade: 2,
    cor: "#25D366",
    termos: [
      "whatsapp", "whats", "zap", "me chama no", "manda no", "manda por",
      "manda mensagem", "manda um audio", "passa no", "mensagem por la",
    ],
  },
  {
    id: "email",
    rotulo: "Pediu e-mail",
    prioridade: 2,
    cor: "#8FB2FC",
    termos: [
      "por e-mail", "por email", "manda um email", "pode ser um email",
      "te passo o email", "arroba", "@",
    ],
  },
  {
    id: "retorno",
    rotulo: "Pediu retorno",
    prioridade: 2,
    cor: "#3E7BFA",
    termos: [
      "liga depois", "me liga", "liga outra hora", "liga amanha",
      "retorna", "retornar", "semana que vem", "proxima semana",
      "outro dia", "amanha", "mais tarde", "outra hora",
      "hoje nao posso", "to ocupado", "estou ocupado", "chegou um cliente",
      "em reuniao", "estou atrasado", "atender um cliente",
    ],
  },
  {
    id: "decisor",
    rotulo: "Falar com decisor",
    prioridade: 2,
    cor: "#8B5CF6",
    termos: [
      "com a diretoria", "com o dono", "com o socio", "com o responsavel",
      "com o gerente", "com o diretor", "setor financeiro", "com a executiva",
      "nao e comigo", "nao sou eu que", "nao passa aqui", "isso e com",
      "seria com", "nao esta na loja", "nao se encontra", "vou transferir",
      "quem cuida disso", "nao sei te dizer", "nao sei lhe informar",
    ],
  },
  {
    id: "ja_tem_banco",
    rotulo: "Já tem taxa no banco",
    prioridade: 2,
    cor: "#FBBF24",
    termos: [
      "ja tenho no banco", "juros baixinho", "taxa boa", "consigo no banco",
      "meu banco", "com o banco", "ja tenho financiamento", "ja trabalho com",
      "sei como funciona", "nao vale a pena",
    ],
  },
  {
    id: "ura",
    rotulo: "Caixa postal / URA",
    prioridade: 4,
    cor: "#475569",
    termos: [
      "digite um", "digite dois", "digite o ramal", "permaneca na linha",
      "esta pessoa nao esta disponivel", "apos o sinal", "deixe outra mensagem",
      "aguarde atendimento", "opcao que voce digitou", "menu principal",
      "sua ligacao ja sera atendida", "seja bem-vindo a", "seja bem vindo a",
    ],
  },
  {
    id: "sem_interesse",
    rotulo: "Sem interesse",
    prioridade: 3,
    cor: "#64748B",
    termos: [
      "nao tenho interesse", "nao temos interesse", "sem interesse",
      "nao quero", "nao me liga", "tira meu numero", "me remove",
      "nao precisa", "nao estou interessad", "nao e adepto",
      "nao trabalhamos com isso",
    ],
  },
];

/** Analisa transcrição + resumo e devolve as etiquetas encontradas. */
export function detectarSinais(ligacao) {
  const texto = `${ligacao.transcript ?? ""} ${ligacao.resumo ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!texto.trim()) return [];

  const achados = [];
  for (const regra of REGRAS) {
    const encontrou = regra.termos.some((t) =>
      texto.includes(t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    );
    if (encontrou) {
      achados.push({ id: regra.id, rotulo: regra.rotulo, cor: regra.cor, prioridade: regra.prioridade });
    }
  }

  // "Sem interesse" cancela os sinais mornos: a recusa é explícita
  if (achados.some((a) => a.id === "sem_interesse")) {
    return achados.filter((a) => a.id === "sem_interesse" || a.prioridade === 1);
  }

  return achados.sort((a, b) => a.prioridade - b.prioridade);
}

/*
 * Duração mínima para uma ligação virar oportunidade.
 * Abaixo de 1 minuto não houve conversa de verdade: mesmo que
 * apareça uma palavra-chave solta, não vale entrar na lista de
 * follow-up. A ligação continua visível nas outras abas.
 */
const MS_MINIMO_OPORTUNIDADE = 60000;

/** Uma ligação é "quente" quando conversou de verdade E deixou sinal. */
export function ehOportunidade(sinais, duracaoMs = null) {
  // Menos de 1 minuto: não aconteceu nada de aproveitável
  if (duracaoMs !== null && duracaoMs < MS_MINIMO_OPORTUNIDADE) return false;
  // URA/caixa postal e áudio ruim não são leads; sem interesse também não
  if (sinais.some((s) => s.id === "ura" || s.id === "audio_ruim")) return false;
  return sinais.some((s) => s.prioridade <= 2 && s.id !== "sem_interesse");
}
