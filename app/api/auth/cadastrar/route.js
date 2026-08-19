import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { gerarHashSenha, criarSessao } from "@/lib/auth";
import { creditarRecarga } from "@/lib/saldo";

/* Cria a conta do cliente e já deixa logado. */
export async function POST(request) {
  const { nome, empresa, email, senha } = await request.json();

  if (!nome || !email || !senha) {
    return NextResponse.json({ erro: "Preencha nome, e-mail e senha." }, { status: 400 });
  }
  if (String(senha).length < 6) {
    return NextResponse.json({ erro: "A senha precisa ter ao menos 6 caracteres." }, { status: 400 });
  }

  await garantirTabelas();

  const { rows: existe } = await sql`
    SELECT id FROM clientes WHERE LOWER(email) = LOWER(${email}) LIMIT 1;
  `;
  if (existe.length) {
    return NextResponse.json({ erro: "Já existe uma conta com esse e-mail." }, { status: 409 });
  }

  const { rows } = await sql`
    INSERT INTO clientes (nome, empresa, email, senha_hash)
    VALUES (${nome}, ${empresa || ""}, ${email}, ${gerarHashSenha(senha)})
    RETURNING id;
  `;
  const clienteId = rows[0].id;

  // Bônus de boas-vindas para o cliente testar (ajuste ou remova se quiser)
  const bonus = Number(process.env.BONUS_BOAS_VINDAS || 0);
  if (bonus > 0) {
    await creditarRecarga({
      clienteId,
      valor: bonus,
      descricao: "Crédito de boas-vindas",
      referencia: `bonus_${clienteId}`,
    });
  }

  criarSessao(clienteId);
  return NextResponse.json({ ok: true });
}
