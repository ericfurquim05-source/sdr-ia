import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { gerarHashSenha, criarSessao } from "@/lib/auth";

/*
 * RECUPERAÇÃO DE SENHA — PASSO 2
 * Valida o token, grava a nova senha, invalida o token e já
 * deixa o cliente logado.
 */
export async function POST(request) {
  try {
    const { token, senha } = await request.json();

    if (!token || !senha) {
      return NextResponse.json({ erro: "Informe a nova senha." }, { status: 400 });
    }
    if (String(senha).length < 6) {
      return NextResponse.json(
        { erro: "A senha precisa ter ao menos 6 caracteres." },
        { status: 400 }
      );
    }

    await garantirTabelas();
    const { rows } = await sql`
      SELECT id FROM clientes
      WHERE reset_token = ${token} AND reset_expira > NOW()
      LIMIT 1;
    `;
    if (!rows.length) {
      return NextResponse.json(
        { erro: "Link inválido ou expirado. Peça um novo." },
        { status: 400 }
      );
    }

    await sql`
      UPDATE clientes
      SET senha_hash = ${gerarHashSenha(senha)}, reset_token = NULL, reset_expira = NULL
      WHERE id = ${rows[0].id};
    `;

    criarSessao(rows[0].id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}
