import { NextResponse } from "next/server";
import { exigirCliente } from "@/lib/auth";
import { creditarRecarga, faixaBonus, RECARGA_MINIMA } from "@/lib/saldo";

/*
 * ============================================================
 * RECARGA DE SALDO
 * ============================================================
 * Regra: mínimo R$ 200; bônus progressivo pela régua em lib/saldo.js.
 *
 * MODO TESTE (RECARGA_MODO_TESTE=1): credita direto, sem pagamento —
 * para validar o fluxo enquanto o site não está aberto ao público.
 *
 * PRODUÇÃO: aqui entra o gateway (Mercado Pago, Stripe ou Asaas):
 * 1. Criar a cobrança Pix/cartão com o valor
 * 2. Receber o webhook de pagamento confirmado
 * 3. SÓ ENTÃO chamar creditarRecarga(valor + bônus)
 */
export async function POST(request) {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  try {
    const { valor } = await request.json();
    const v = Math.round(Number(valor) * 100) / 100;

    if (!v || v < RECARGA_MINIMA) {
      return NextResponse.json(
        { erro: `A recarga mínima é de R$ ${RECARGA_MINIMA},00.` },
        { status: 400 }
      );
    }

    const { percentual, bonus, totalCreditado } = faixaBonus(v);

    if (String(process.env.RECARGA_MODO_TESTE || "") !== "1") {
      return NextResponse.json(
        { erro: "Pagamento ainda não configurado. Conecte o gateway (Mercado Pago/Asaas) para liberar recargas reais." },
        { status: 501 }
      );
    }

    await creditarRecarga({
      clienteId: cliente.id,
      valor: totalCreditado,
      descricao: `Recarga de R$ ${v.toFixed(2).replace(".", ",")}${percentual ? ` + ${percentual}% de bônus` : ""} (modo teste)`,
      referencia: `recarga_teste_${cliente.id}_${Date.now()}`,
    });

    return NextResponse.json({
      ok: true,
      creditado: totalCreditado,
      bonus,
      mensagem: percentual
        ? `R$ ${totalCreditado.toFixed(2).replace(".", ",")} creditados (R$ ${bonus.toFixed(2).replace(".", ",")} de bônus, +${percentual}%).`
        : `R$ ${totalCreditado.toFixed(2).replace(".", ",")} creditados.`,
    });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
