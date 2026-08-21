import { NextResponse } from "next/server";
import { exigirCliente, gerarHashSenha } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/*
 * Gestão da equipe — só o gestor da conta usa.
 * Cria, desativa e redefine senha dos corretores.
 */
export async function POST(request) {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  try {
    const { acao, nome, email, usuarioId } = await request.json();
    await garantirTabelas();

    if (acao === "criar") {
      if (!nome || !email) {
        return NextResponse.json({ erro: "Informe nome e e-mail." }, { status: 400 });
      }

      const { rows: existe } = await sql`
        SELECT id FROM usuarios WHERE LOWER(email) = LOWER(${email}) LIMIT 1;
      `;
      if (existe.length) {
        return NextResponse.json({ erro: "Já existe alguém com esse e-mail." }, { status: 409 });
      }

      // Senha temporária: o gestor repassa e a pessoa troca depois
      const senha = crypto.randomBytes(4).toString("hex");
      await sql`
        INSERT INTO usuarios (cliente_id, nome, email, senha_hash, papel)
        VALUES (${cliente.id}, ${nome}, ${email}, ${gerarHashSenha(senha)}, 'corretor');
      `;
      return NextResponse.json({
        ok: true,
        senha,
        mensagem: `${nome} foi adicionado. Repasse o e-mail e a senha temporária.`,
      });
    }

    if (acao === "desativar") {
      await sql`
        UPDATE usuarios SET ativo = NOT ativo
        WHERE id = ${usuarioId} AND cliente_id = ${cliente.id};
      `;
      return NextResponse.json({ ok: true, mensagem: "Status atualizado." });
    }

    if (acao === "nova_senha") {
      const senha = crypto.randomBytes(4).toString("hex");
      await sql`
        UPDATE usuarios SET senha_hash = ${gerarHashSenha(senha)}
        WHERE id = ${usuarioId} AND cliente_id = ${cliente.id};
      `;
      return NextResponse.json({ ok: true, senha, mensagem: "Nova senha temporária criada." });
    }

    return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
