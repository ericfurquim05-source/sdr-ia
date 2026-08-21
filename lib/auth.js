import { cookies } from "next/headers";
import crypto from "crypto";
import { garantirTabelas, sql } from "@/lib/db";

/*
 * ============================================================
 * AUTENTICAÇÃO — LOGIN PRÓPRIO, SEM DEPENDÊNCIA EXTERNA
 * ============================================================
 * Senha: scrypt com salt aleatório por usuário (padrão do Node).
 * Sessão: cookie httpOnly assinado com HMAC — não dá para forjar
 * sem o segredo, e não precisa de tabela de sessões.
 *
 * Variável obrigatória: SESSAO_SEGREDO (string longa e aleatória).
 */

const NOME_COOKIE = "sdr_sessao";
const DURACAO_DIAS = 30;

function segredo() {
  const s = process.env.SESSAO_SEGREDO;
  if (!s) throw new Error("SESSAO_SEGREDO não configurada nas variáveis de ambiente.");
  return s;
}

// ---------- Senhas ----------

export function gerarHashSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function conferirSenha(senha, armazenado) {
  const [salt, hash] = String(armazenado).split(":");
  if (!salt || !hash) return false;
  const tentativa = crypto.scryptSync(senha, salt, 64);
  const guardado = Buffer.from(hash, "hex");
  if (tentativa.length !== guardado.length) return false;
  return crypto.timingSafeEqual(tentativa, guardado); // comparação à prova de timing
}

// ---------- Sessão ----------

function assinar(dados) {
  return crypto.createHmac("sha256", segredo()).update(dados).digest("base64url");
}

export function criarSessao(clienteId) {
  const expira = Date.now() + DURACAO_DIAS * 24 * 60 * 60 * 1000;
  const dados = `${clienteId}.${expira}`;
  const token = `${dados}.${assinar(dados)}`;

  cookies().set(NOME_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_DIAS * 24 * 60 * 60,
  });
}

export function encerrarSessao() {
  cookies().delete(NOME_COOKIE);
}

/** Lê o cookie e devolve o cliente_id, ou null se inválido/expirado. */
export function clienteIdDaSessao() {
  const token = cookies().get(NOME_COOKIE)?.value;
  if (!token) return null;

  const [id, expira, assinatura] = token.split(".");
  if (!id || !expira || !assinatura) return null;

  const esperada = assinar(`${id}.${expira}`);
  if (assinatura.length !== esperada.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return null;
  if (Number(expira) < Date.now()) return null;

  return Number(id);
}

/** Busca o cliente logado (ou null). Use em páginas e rotas. */
export async function clienteLogado() {
  const id = clienteIdDaSessao();
  if (!id) return null;
  await garantirTabelas();
  const { rows } = await sql`
    SELECT id, nome, empresa, email, preco_minuto, preco_conversa, google_ics_url, ativo
    FROM clientes WHERE id = ${id} AND ativo = TRUE LIMIT 1;
  `;
  return rows[0] ?? null;
}

/**
 * O administrador é definido pela variável ADMIN_EMAIL.
 * Ele acessa o painel /admin para dar suporte aos clientes.
 */
export function ehAdmin(cliente) {
  const admin = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!admin || !cliente?.email) return false;
  return String(cliente.email).trim().toLowerCase() === admin;
}

/** Exige que o logado seja o administrador. */
export async function exigirAdmin() {
  const cliente = await clienteLogado();
  if (!cliente || !ehAdmin(cliente)) {
    const erro = new Error("nao_autorizado");
    erro.status = 403;
    throw erro;
  }
  return cliente;
}

/** Igual ao anterior, mas lança erro 401 nas rotas de API. */
export async function exigirCliente() {
  const cliente = await clienteLogado();
  if (!cliente) {
    const erro = new Error("nao_autenticado");
    erro.status = 401;
    throw erro;
  }
  return cliente;
}
