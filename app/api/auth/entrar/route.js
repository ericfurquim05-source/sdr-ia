import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { conferirSenha, criarSessao } from "@/lib/auth";

/* Login do cliente. */
export async function POST(request) {
  let dados;
  try {
    dados = await request.json();
  } catch {
    return NextResponse.json({ erro: "Requisição inválida." }, { status: 400 });
  }
  const { email, senha } = dados;
  await garantirTabelas();

  const { rows } = await sql`
    SELECT id, senha_hash, ativo FROM clientes
    WHERE LOWER(email) = LOWER(${email}) LIMIT 1;
  `;
  const cliente = rows[0];

  // Mensagem genérica de propósito: não entrega se o e-mail existe
  if (!cliente || !conferirSenha(senha ?? "", cliente.senha_hash)) {
    return NextResponse.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
  }
  if (!cliente.ativo) {
    return NextResponse.json({ erro: "Conta desativada. Fale com o suporte." }, { status: 403 });
  }

  criarSessao(cliente.id);
  return NextResponse.json({ ok: true });
}
