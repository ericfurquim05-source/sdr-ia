import { NextResponse } from "next/server";
import crypto from "crypto";
import { garantirTabelas, sql } from "@/lib/db";

/*
 * ============================================================
 * RECUPERAÇÃO DE SENHA — PASSO 1
 * ============================================================
 * Gera um token de uso único, válido por 1 hora.
 *
 * Se RESEND_API_KEY estiver configurada, envia o link por e-mail.
 * Se não estiver, o link fica disponível no painel /admin para
 * você repassar ao cliente por WhatsApp — assim a recuperação
 * funciona mesmo sem servidor de e-mail contratado.
 *
 * A resposta é sempre a mesma, exista o e-mail ou não: não
 * revelar quais e-mails estão cadastrados é regra de segurança.
 */
export async function POST(request) {
  const respostaPadrao = NextResponse.json({
    ok: true,
    mensagem:
      "Se este e-mail estiver cadastrado, o link de redefinição será enviado. Não chegou? Fale com o suporte.",
  });

  try {
    const { email } = await request.json();
    if (!email) return respostaPadrao;

    await garantirTabelas();
    const { rows } = await sql`
      SELECT id, nome FROM clientes WHERE LOWER(email) = LOWER(${email}) LIMIT 1;
    `;
    if (!rows.length) return respostaPadrao;

    const token = crypto.randomBytes(24).toString("base64url");
    await sql`
      UPDATE clientes
      SET reset_token = ${token}, reset_expira = NOW() + INTERVAL '1 hour'
      WHERE id = ${rows[0].id};
    `;

    const link = `${process.env.URL_DO_SITE || "https://sdr-ia-six.vercel.app"}/redefinir?token=${token}`;

    // Envio por e-mail (opcional)
    if (process.env.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_REMETENTE || "SDR IA <onboarding@resend.dev>",
          to: email,
          subject: "Redefinir sua senha — SDR IA",
          html: `<p>Olá${rows[0].nome ? ", " + rows[0].nome : ""}!</p>
                 <p>Para criar uma nova senha, acesse o link abaixo. Ele vale por 1 hora:</p>
                 <p><a href="${link}">${link}</a></p>
                 <p>Se você não pediu isso, pode ignorar este e-mail.</p>`,
        }),
      }).catch(() => {});
    }

    return respostaPadrao;
  } catch {
    return respostaPadrao;
  }
}
