/*
 * Leitura da planilha de contatos (CSV ou Excel) direto no navegador.
 * Retorna sempre uma lista [{ nome, telefone }] com telefone em E.164.
 */

// Normaliza o telefone para o formato aceito pela Retell: +55DDNNNNNNNNN
export function normalizarTelefone(bruto) {
  if (!bruto) return null;
  let numero = String(bruto).replace(/\D/g, ""); // tira ( ) - espaço etc.
  if (!numero) return null;

  // Remove zeros à esquerda (ex.: 011 98456-7712)
  numero = numero.replace(/^0+/, "");

  // Sem código do país? Assume Brasil.
  if (numero.length === 10 || numero.length === 11) numero = "55" + numero;

  // Precisa ter DDI + DDD + número
  if (numero.length < 12 || numero.length > 15) return null;

  return "+" + numero;
}

// Descobre qual coluna é nome e qual é telefone, pelo cabeçalho
function mapearColunas(cabecalho) {
  const limpo = cabecalho.map((c) =>
    String(c || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
  const acharCol = (chaves) => limpo.findIndex((c) => chaves.some((k) => c.includes(k)));

  return {
    iNome: acharCol(["nome", "name", "contato", "cliente"]),
    iTelefone: acharCol(["telefone", "celular", "fone", "phone", "whatsapp", "numero"]),
  };
}

function linhasParaContatos(linhas) {
  if (!linhas.length) return [];

  const { iNome, iTelefone } = mapearColunas(linhas[0]);
  const temCabecalho = iTelefone !== -1;

  // Sem cabeçalho reconhecido: assume coluna 0 = nome, coluna 1 = telefone
  const colNome = temCabecalho ? iNome : 0;
  const colTel = temCabecalho ? iTelefone : 1;
  const corpo = temCabecalho ? linhas.slice(1) : linhas;

  const contatos = [];
  for (const linha of corpo) {
    const telefone = normalizarTelefone(linha[colTel]);
    if (!telefone) continue; // pula linha inválida ou vazia
    contatos.push({
      nome: String(linha[colNome] ?? "").trim(),
      telefone,
    });
  }
  return contatos;
}

// Parse de CSV que respeita aspas e aceita vírgula ou ponto e vírgula
function lerCSV(texto) {
  const separador = (texto.split("\n")[0].match(/;/g) || []).length >
    (texto.split("\n")[0].match(/,/g) || []).length ? ";" : ",";

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
