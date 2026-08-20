/*
 * Leitura da planilha de contatos (CSV ou Excel) direto no navegador.
 * Retorna sempre uma lista [{ nome, telefone }], onde telefone são os
 * dígitos locais: DDD + número (ex.: 51980554326).
 *
 * O prefixo do tronco SIP (ex.: 968655) NÃO entra aqui — ele é aplicado
 * no backend, a partir da variável RETELL_PREFIXO_DISCAGEM, para que uma
 * troca de operadora não exija mexer no código nem refazer as planilhas.
 */

// Prefixos de tronco conhecidos que podem vir colados na planilha
const PREFIXOS_CONHECIDOS = ["968655"];

/**
 * Normaliza um telefone para os dígitos locais (DDD + número).
 * Aceita (51) 98055-4326, 51980554326, +5551980554326, 051980554326,
 * e também números que já vieram com o prefixo do tronco.
 */
export function normalizarTelefone(bruto) {
  if (!bruto) return null;
  let n = String(bruto).replace(/\D/g, "");
  if (!n) return null;

  // Já veio com o prefixo do tronco colado? Remove para não duplicar.
  for (const prefixo of PREFIXOS_CONHECIDOS) {
    if (n.length > prefixo.length + 9 && n.startsWith(prefixo)) {
      n = n.slice(prefixo.length);
      break;
    }
  }

  // 0800 e afins passam direto
  if (/^0(800|300|500)/.test(n)) return n;

  // Remove zero de operadora na frente (ex.: 051 98055-4326)
  n = n.replace(/^0+/, "");

  // Remove o código do país quando ele realmente está presente.
  // Cuidado: DDD 55 (Santa Maria) também começa com 55, por isso o
  // corte só acontece se sobrarem 10 ou 11 dígitos válidos.
  if ((n.length === 12 || n.length === 13) && n.startsWith("55")) {
    n = n.slice(2);
  }

  // Local válido no Brasil: DDD (2) + fixo (8) ou celular (9)
  if (n.length !== 10 && n.length !== 11) return null;

  // DDD válido vai de 11 a 99
  const ddd = Number(n.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  return n;
}

/**
 * Limpa o nome vindo da planilha para uso em conversa.
 * Bases de CNPJ costumam trazer códigos e razão social:
 *   "66.681.913 LARISSA LEITE COSTA" → "Larissa"
 *   "TEUTO AGUA POCOS E REDES LTDA"  → "Teuto"
 * É esse valor que vai para {{nome}} na ligação e {{1}} no WhatsApp.
 */
export function limparNome(bruto) {
  let n = String(bruto || "").trim();
  if (!n) return "";

  // Remove códigos numéricos do início (66.681.913, 12345-6, etc.)
  n = n.replace(/^[\d.\-/\s]+/, "").trim();

  // Remove sufixos societários
  n = n.replace(/\b(LTDA|ME|EPP|EIRELI|S\/?A|MEI|SOCIEDADE|COMERCIO|COM|IND)\b\.?/gi, "").trim();

  if (!n) return "";

  // Primeiro nome, com inicial maiúscula
  const primeiro = n.split(/\s+/)[0];
  if (primeiro.length < 2) return "";
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

/** Formata só para exibição na tela: (51) 98055-4326 */
export function formatarExibicao(n) {
  if (!n) return "";
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
}

// Descobre qual coluna é nome e qual é telefone, pelo cabeçalho
function mapearColunas(cabecalho) {
  const limpo = cabecalho.map((c) =>
    String(c || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
  const acharCol = (chaves) => limpo.findIndex((c) => chaves.some((k) => c.includes(k)));

  return {
    iNome: acharCol(["nome", "name", "contato", "cliente", "empresa"]),
    iTelefone: acharCol(["telefone", "celular", "fone", "phone", "whatsapp", "numero", "completo"]),
  };
}

function linhasParaContatos(linhas) {
  if (!linhas.length) return [];

  const { iNome, iTelefone } = mapearColunas(linhas[0]);
  const temCabecalho = iTelefone !== -1;

  // Sem cabeçalho reconhecido: procura em todas as colunas da linha
  const corpo = temCabecalho ? linhas.slice(1) : linhas;
  const colNome = temCabecalho ? iNome : -1;

  const contatos = [];
  const jaVistos = new Set();

  for (const linha of corpo) {
    let telefone = null;

    if (temCabecalho) {
      telefone = normalizarTelefone(linha[iTelefone]);
    } else {
      // varre a linha inteira até achar algo que pareça telefone
      for (const celula of linha) {
        telefone = normalizarTelefone(celula);
        if (telefone) break;
      }
    }

    if (!telefone) continue;
    if (jaVistos.has(telefone)) continue; // remove duplicados
    jaVistos.add(telefone);

    contatos.push({
      nome: colNome >= 0 ? String(linha[colNome] ?? "").trim() : "",
      telefone,
    });
  }
  return contatos;
}

// Parse de CSV que respeita aspas e aceita vírgula, ponto e vírgula ou tabulação
function lerCSV(texto) {
  const primeira = texto.split("\n")[0];
  const contar = (c) => (primeira.match(new RegExp("\\" + c, "g")) || []).length;
  let separador = ",";
  if (contar(";") > contar(",")) separador = ";";
  if (contar("\t") > contar(separador)) separador = "\t";

  const linhas = [];
  let campo = "";
  let linha = [];
  let dentroDeAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentroDeAspas = false;
      else campo += c;
    } else if (c === '"') dentroDeAspas = true;
    else if (c === separador) { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo); linhas.push(linha); linha = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  linha.push(campo);
  linhas.push(linha);

  return linhas.filter((l) => l.some((c) => String(c).trim() !== ""));
}

/**
 * Analisa a planilha SEM converter: devolve as colunas encontradas,
 * as linhas cruas e a sugestão de qual coluna é nome e qual é telefone.
 * É o que alimenta o painel de conferência na tela de Campanhas.
 */
export async function analisarPlanilha(file) {
  const linhas = await lerLinhas(file);
  if (!linhas.length) return { colunas: [], linhas: [], mapa: { nome: -1, telefone: -1 } };

  const { iNome, iTelefone } = mapearColunas(linhas[0]);
  const temCabecalho = iTelefone !== -1;

  // Sem cabeçalho reconhecido, tenta achar a coluna com cara de telefone
  let colTelefone = iTelefone;
  if (!temCabecalho) {
    const amostra = linhas.slice(0, 5);
    const totalColunas = Math.max(...amostra.map((l) => l.length));
    for (let c = 0; c < totalColunas; c++) {
      const acertos = amostra.filter((l) => normalizarTelefone(l[c])).length;
      if (acertos >= Math.ceil(amostra.length / 2)) {
        colTelefone = c;
        break;
      }
    }
  }

  // Coluna de nome: a sugerida, ou a primeira que não seja a do telefone
  let colNome = temCabecalho ? iNome : -1;
  if (colNome === -1) colNome = colTelefone === 0 ? 1 : 0;

  const colunas = temCabecalho
    ? linhas[0].map((c, i) => String(c || "").trim() || `Coluna ${i + 1}`)
    : linhas[0].map((_, i) => `Coluna ${i + 1}`);

  return {
    colunas,
    temCabecalho,
    linhas: temCabecalho ? linhas.slice(1) : linhas,
    mapa: { nome: colNome, telefone: colTelefone },
  };
}

/**
 * Aplica o mapa de colunas e devolve o resultado da conversão,
 * separando o que entrou, o que foi ignorado e por quê.
 */
export function montarContatos(linhas, mapa) {
  const contatos = [];
  const invalidos = [];
  const duplicados = [];
  const vistos = new Set();

  for (const linha of linhas) {
    const bruto = linha[mapa.telefone];
    const telefone = normalizarTelefone(bruto);
    const nome = limparNome(linha[mapa.nome]);

    if (!telefone) {
      const textoBruto = String(bruto ?? "").trim();
      if (!textoBruto && !nome) continue; // linha totalmente vazia: ignora em silêncio
      invalidos.push({ nome, bruto: textoBruto || "(vazio)" });
      continue;
    }
    if (vistos.has(telefone)) {
      duplicados.push({ nome, telefone });
      continue;
    }
    vistos.add(telefone);
    contatos.push({ nome, telefone });
  }

  return { contatos, invalidos, duplicados };
}

/** Lê o arquivo e devolve as linhas cruas (CSV ou Excel). */
async function lerLinhas(file) {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".csv") || nome.endsWith(".txt")) {
    return lerCSV(await file.text());
  }
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const pasta = XLSX.read(buffer, { type: "array" });
  const primeiraAba = pasta.Sheets[pasta.SheetNames[0]];
  return XLSX.utils.sheet_to_json(primeiraAba, { header: 1, raw: false, defval: "" });
}

export async function lerContatos(file) {
  const nome = file.name.toLowerCase();

  if (nome.endsWith(".csv") || nome.endsWith(".txt")) {
    return linhasParaContatos(lerCSV(await file.text()));
  }

  // Excel: carrega a biblioteca só quando precisa
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const pasta = XLSX.read(buffer, { type: "array" });
  const primeiraAba = pasta.Sheets[pasta.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(primeiraAba, { header: 1, raw: false, defval: "" });
  return linhasParaContatos(linhas);
}
