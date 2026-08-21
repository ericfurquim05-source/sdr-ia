import { NextResponse } from "next/server";
import crypto from "crypto";
import { exigirAdmin, gerarHashSenha } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { creditarRecarga } from "@/lib/saldo";

export const dynamic = "force-dynamic";

/*
 * ============================================================
 * PAINEL DE ADMINISTRAÇÃO — SUPORTE AOS CLIENTES
 * ============================================================
 * Só o e-mail definido em ADMIN_EMAIL acessa.
 * Permite resolver os pedidos do dia a dia sem depender de
 * deploy: gerar link de senha, creditar saldo, ativar/desativar
 * conta e ajustar o preço por minuto de cada cliente.
 */
export async function POST(request) {
  let admin;
  try {
    admin = await exigirAdmin();
  } catch {
    return NextResponse.json({ erro: "Acesso restrito." }, { status: 403 });
  }

  try {
    const { acao, clienteId, valor } = await request.json();
    await garantirTabelas();

    if (acao === "link_senha") {
      const token = crypto.randomBytes(24).toString("base64url");
      await sql`
        UPDATE clientes SET reset_token = ${token}, reset_expira = NOW() + INTERVAL '24 hours'
        WHERE id = ${clienteId};
      `;
      const base = process.env.URL_DO_SITE || "https://sdr-ia-six.vercel.app";
      return NextResponse.json({
        ok: true,
        link: `${base}/redefinir?token=${token}`,
        mensagem: "Link válido por 24 horas. Envie ao cliente.",
      });
    }

    if (acao === "creditar") {
      const v = Number(valor);
      if (!Number.isFinite(v) || v === 0) {
        return NextResponse.json({ erro: "Informe um valor." }, { status: 400 });
      }
      await creditarRecarga({
        clienteId,
        valor: Math.abs(v),
        descricao: `Crédito manual lançado pelo suporte (${admin.email})`,
        referencia: `admin_${clienteId}_${Date.now()}`,
      });
      return NextResponse.json({ ok: true, mensagem: "Saldo creditado." });
    }

    if (acao === "alternar_ativo") {
      const { rows } = await sql`
        UPDATE clientes SET ativo = NOT ativo WHERE id = ${clienteId} RETURNING ativo;
      `;
      return NextResponse.json({
        ok: true,
        mensagem: rows[0]?.ativo ? "Conta reativada." : "Conta desativada.",
      });
    }

    if (acao === "preco_minuto") {
      const v = Number(valor);
      if (!Number.isFinite(v) || v <= 0) {
        return NextResponse.json({ erro: "Preço inválido." }, { status: 400 });
      }
      await sql`UPDATE clientes SET preco_minuto = ${v} WHERE id = ${clienteId};`;
      return NextResponse.json({ ok: true, mensagem: `Preço ajustado para R$ ${v}/min.` });
    }

    if (acao === "nova_senha") {
      const senha = crypto.randomBytes(4).toString("hex"); // 8 caracteres
      await sql`
        UPDATE clientes SET senha_hash = ${gerarHashSenha(senha)}, reset_token = NULL
        WHERE id = ${clienteId};
      `;
      return NextResponse.json({
        ok: true,
        senha,
        mensagem: "Senha temporária criada. Peça ao cliente para trocá-la depois.",
      });
    }

    return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
