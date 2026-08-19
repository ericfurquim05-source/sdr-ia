"use client";

import { useState } from "react";
import { Zap } from "lucide-react";

/*
 * Botões de recarga da Carteira.
 * IMPORTANTE: nada de somar saldo na tela — o crédito real só pode
 * nascer no backend, quando o gateway confirmar o pagamento.
 * Enquanto o gateway não é conectado, o botão apenas explica isso.
 */

const pacotes = [
  { valor: 50, tag: null, bonus: null },
  { valor: 100, tag: "Mais popular", bonus: "+5% de minutos de bônus" },
  { valor: 500, tag: "Melhor custo", bonus: "+15% de minutos de bônus" },
];

const reais = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PacotesRecarga({ precoMinuto = 1.5 }) {
  const [aviso, setAviso] = useState(null);

  const comprar = (valor) => {
    // ============================================================
    // TODO: GATEWAY DE PAGAMENTO ENTRA AQUI
    // Criar o checkout (Mercado Pago / Stripe / Asaas), redirecionar
    // o usuário e creditar via webhook de pagamento confirmado,
    // chamando creditarRecarga() no backend.
    // ============================================================
    setAviso(
      `Pacote de ${reais(valor)} selecionado. O pagamento online será liberado em breve — por enquanto, fale com o suporte para adicionar saldo.`
    );
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {pacotes.map((p) => (
          <div
            key={p.valor}
            className={`card relative p-5 ${p.tag === "Mais popular" ? "border-brand-violet ring-1 ring-brand-violet/50" : ""}`}
          >
            {p.tag && (
              <span className="absolute -top-2.5 left-4 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet px-2 py-0.5 text-xs font-semibold text-white">
                {p.tag}
              </span>
            )}
            <p className="font-display text-2xl font-semibold text-white">{reais(p.valor)}</p>
            <p className="mb-4 mt-0.5 text-xs text-slate-400">
              ≈ {Math.floor(p.valor / precoMinuto)} minutos
              {p.bonus && <span className="block text-emerald-400">{p.bonus}</span>}
            </p>
            <button onClick={() => comprar(p.valor)} className="btn-primario w-full text-sm">
              <Zap size={14} /> Adicionar {reais(p.valor)}
            </button>
          </div>
        ))}
      </div>

      {aviso && (
        <p className="mt-4 rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-3 text-sm text-blue-200">
          {aviso}
        </p>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Pagamento via Pix ou cartão — pronto para receber o gateway (Mercado Pago, Stripe ou Asaas).
      </p>
    </>
  );
}
