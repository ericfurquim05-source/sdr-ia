// ============================================================
// DADOS DE EXEMPLO (mock)
// Substituir pelos dados reais vindos do banco de dados,
// alimentado pelos webhooks da Retell AI.
// ============================================================

export const kpisHoje = {
  total: 128,
  atendidas: 87,
  naoAtendidas: 41,
  reunioesIA: 9,
};

// Últimos 7 dias úteis — taxa de atendimento e conversão (%)
export const serieSemanal = [
  { dia: "11/08", atendimento: 52, conversao: 9 },
  { dia: "12/08", atendimento: 57, conversao: 12 },
  { dia: "13/08", atendimento: 61, conversao: 14 },
  { dia: "14/08", atendimento: 64, conversao: 15 },
  { dia: "17/08", atendimento: 59, conversao: 13 },
  { dia: "18/08", atendimento: 66, conversao: 17 },
  { dia: "19/08", atendimento: 68, conversao: 19 },
];

export const desfechosHoje = [
  { rotulo: "Reunião agendada pela IA", qtd: 9, cor: "bg-brand-violet" },
  { rotulo: "Interessado — follow-up", qtd: 21, cor: "bg-brand-cyan" },
  { rotulo: "Pediu retorno depois", qtd: 18, cor: "bg-brand-blue" },
  { rotulo: "Sem interesse", qtd: 39, cor: "bg-slate-500" },
  { rotulo: "Não atendeu / caixa postal", qtd: 41, cor: "bg-slate-700" },
];

// Histórico de chamadas — cada registro virá do webhook da Retell
// (recording_url, transcript, call_analysis.call_summary etc.)
export const chamadas = [
  {
    id: "ch_001",
    nome: "Mariana Costa",
    empresa: "Clínica Vitalle",
    numero: "(11) 98456-7712",
    horario: "Hoje, 16:42",
    duracao: "4:07",
    duracaoSegundos: 247,
    status: "Reunião agendada",
    recordingUrl: null, // preenchido pelo webhook da Retell
    resumo:
      "Lead demonstrou forte interesse em automatizar a prospecção da clínica. A IA apresentou o modelo pré-pago, contornou a objeção de preço e agendou uma reunião de demonstração para quinta-feira, 21/08, às 10:30.",
    transcricao: [
      { quem: "IA", fala: "Olá, Mariana! Aqui é a Sofia, assistente da SDR IA. Tudo bem? Vi que você pediu uma demonstração pelo nosso site." },
      { quem: "Lead", fala: "Oi! Sim, pedi mesmo. A gente tá com dificuldade de dar conta dos leads aqui na clínica." },
      { quem: "IA", fala: "Entendo perfeitamente. Hoje vocês fazem esse primeiro contato manualmente?" },
      { quem: "Lead", fala: "Sim, e a equipe não dá conta. Quanto custa isso?" },
      { quem: "IA", fala: "Funciona no pré-pago, você só paga pelos minutos falados — sem mensalidade. Posso agendar 30 minutos com um especialista pra te mostrar na prática? Tenho quinta às 10:30." },
      { quem: "Lead", fala: "Quinta 10:30 fica ótimo. Pode marcar!" },
    ],
  },
  {
    id: "ch_002",
    nome: "João Pereira",
    empresa: "Construtora Alfa",
    numero: "(31) 99712-0034",
    horario: "Hoje, 15:58",
    duracao: "3:12",
    duracaoSegundos: 192,
    status: "Reunião agendada",
    recordingUrl: null,
    resumo:
      "Prospecção fria. Lead nunca tinha ouvido falar da solução, mas se interessou pela redução de custo com SDRs humanos. Reunião agendada para amanhã, 20/08, às 14:00.",
    transcricao: [
      { quem: "IA", fala: "Boa tarde, João! Falo com o responsável comercial da Construtora Alfa?" },
      { quem: "Lead", fala: "Sou eu sim, quem fala?" },
      { quem: "IA", fala: "Aqui é a Sofia, da SDR IA. Ajudamos construtoras a qualificar leads por telefone usando inteligência artificial, pagando só por minuto falado. Faz sentido eu te mostrar como funciona?" },
      { quem: "Lead", fala: "Olha, interessante... a gente gasta muito com equipe de pré-venda hoje." },
      { quem: "IA", fala: "Exatamente onde mais geramos economia. Consigo uma demonstração amanhã às 14h, pode ser?" },
      { quem: "Lead", fala: "Pode sim, amanhã 14h tá fechado." },
    ],
  },
  {
    id: "ch_003",
    nome: "Carlos Mendes",
    empresa: "Auto Peças Silva",
    numero: "(19) 99801-4455",
    horario: "Hoje, 15:21",
    duracao: "1:48",
    duracaoSegundos: 108,
    status: "Atendida",
    recordingUrl: null,
    resumo:
      "Lead atendeu, mas está em semana de fechamento de estoque. Pediu retorno na próxima semana. A IA registrou a preferência por contato após o dia 25/08, no período da manhã.",
    transcricao: [
      { quem: "IA", fala: "Olá, Carlos! Aqui é a Sofia, da SDR IA. Te peguei em um bom momento?" },
      { quem: "Lead", fala: "Na verdade tô no meio do fechamento de estoque, semana corrida." },
      { quem: "IA", fala: "Sem problema! Posso te ligar na próxima semana, depois do dia 25? Qual período fica melhor?" },
      { quem: "Lead", fala: "Pode ser, de manhã é melhor." },
      { quem: "IA", fala: "Combinado, Carlos. Te ligo na terça de manhã. Bom fechamento!" },
    ],
  },
  {
    id: "ch_004",
    nome: "Fernanda Lima",
    empresa: "FL Arquitetura",
    numero: "(21) 98122-9080",
    horario: "Hoje, 14:55",
    duracao: "—",
    duracaoSegundos: 0,
    status: "Não atendida",
    recordingUrl: null,
    resumo: "Chamada não atendida. Caiu na caixa postal — nova tentativa programada automaticamente para amanhã às 10:00.",
    transcricao: [],
  },
  {
    id: "ch_005",
    nome: "Roberto Nunes",
    empresa: "Mercado Bom Preço",
    numero: "(41) 99655-2310",
    horario: "Hoje, 14:32",
    duracao: "2:26",
    duracaoSegundos: 146,
    status: "Atendida",
    recordingUrl: null,
    resumo:
      "Lead informou que já contratou outra solução de telefonia este mês e não tem interesse no momento. A IA registrou o motivo e marcou o contato para reavaliação em 90 dias.",
    transcricao: [
      { quem: "IA", fala: "Boa tarde, Roberto! Aqui é a Sofia, da SDR IA. Trabalhamos com prospecção automatizada por voz." },
      { quem: "Lead", fala: "Ah, obrigado, mas acabamos de fechar com outra empresa esse mês." },
      { quem: "IA", fala: "Entendi, sem problemas! Posso registrar um retorno daqui a uns meses pra ver como foi a experiência?" },
      { quem: "Lead", fala: "Pode sim, sem compromisso." },
    ],
  },
  {
    id: "ch_006",
    nome: "Patrícia Alves",
    empresa: "Studio Fit",
    numero: "(51) 98044-1276",
    horario: "Hoje, 14:10",
    duracao: "—",
    duracaoSegundos: 0,
    status: "Não atendida",
    recordingUrl: null,
    resumo: "Chamada não atendida após 5 toques. Reagendada automaticamente para o próximo horário de maior taxa de atendimento (17:30).",
    transcricao: [],
  },
];

// Agendamentos do mês — origem "ia" = marcado pela IA durante a ligação
export const eventosAgenda = [
  { dia: 20, hora: "14:00", titulo: "João Pereira — Construtora Alfa", origem: "ia" },
  { dia: 21, hora: "10:30", titulo: "Mariana Costa — Clínica Vitalle", origem: "ia" },
  { dia: 24, hora: "11:00", titulo: "Follow-up — Carlos Mendes", origem: "manual" },
  { dia: 27, hora: "15:30", titulo: "Demonstração — Studio Fit", origem: "ia" },
];

export const horarioAtendimento = {
  descricao: "Segunda a sexta, das 09:00 às 18:00",
  diasBloqueados: [0, 6], // domingo e sábado
};

// Conversas do módulo WhatsApp (mock — plugar API oficial depois)
export const conversas = [
  {
    id: "wa_01",
    nome: "Mariana Costa",
    hora: "16:50",
    naoLidas: 2,
    ultima: "Perfeito, confirmado então! 👍",
    mensagens: [
      { de: "lead", texto: "Oi! A Sofia me ligou agora há pouco, ficou marcado quinta 10:30 mesmo?", hora: "16:47" },
      { de: "eu", texto: "Oi, Mariana! Isso mesmo, quinta às 10:30. Vou te mandar o link da reunião por aqui.", hora: "16:48" },
      { de: "lead", texto: "Perfeito, confirmado então! 👍", hora: "16:50" },
    ],
  },
  {
    id: "wa_02",
    nome: "João Pereira",
    hora: "16:12",
    naoLidas: 1,
    ultima: "Pode me mandar o endereço do escritório?",
    mensagens: [
      { de: "lead", texto: "Boa tarde! Sobre a reunião de amanhã às 14h...", hora: "16:10" },
      { de: "lead", texto: "Pode me mandar o endereço do escritório?", hora: "16:12" },
    ],
  },
  {
    id: "wa_03",
    nome: "Carlos Mendes",
    hora: "15:30",
    naoLidas: 0,
    ultima: "Pode me ligar semana que vem sim",
    mensagens: [
      { de: "lead", texto: "Pode me ligar semana que vem sim", hora: "15:30" },
    ],
  },
  {
    id: "wa_04",
    nome: "Fernanda Lima",
    hora: "Ontem",
    naoLidas: 0,
    ultima: "Vocês atendem escritórios de arquitetura?",
    mensagens: [
      { de: "lead", texto: "Vocês atendem escritórios de arquitetura?", hora: "Ontem" },
    ],
  },
];

// Carteira (modelo pré-pago por minutagem)
export const carteira = {
  saldo: 247.5,
  precoMinuto: 1.49,
  consumoMes: 512.5,
};

export const transacoes = [
  { data: "19/08", descricao: "Campanha “Leads do site — agosto” · 34 ligações", minutos: 92, valor: -137.08 },
  { data: "18/08", descricao: "Campanha “Prospecção fria — clínicas” · 51 ligações", minutos: 118, valor: -175.82 },
  { data: "15/08", descricao: "Recarga via Pix", minutos: null, valor: 200.0 },
  { data: "13/08", descricao: "Campanha “Reativação de leads” · 27 ligações", minutos: 64, valor: -95.36 },
  { data: "10/08", descricao: "Recarga via cartão de crédito", minutos: null, valor: 100.0 },
];
