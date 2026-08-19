"use client";

import { useState } from "react";
import { Zap, CheckCircle2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/Interface";
import { carteira, transacoes } from "@/lib/dados";

const pacotes = [
  { valor: 50, tag: null, bonus: null },
  { valor: 100, tag: "Mais popular", bonus: "+5% de minutos de bônus" },
  { valor: 500, tag: "Melhor custo", bonus: "+15% de minutos de bônus" },
];

const reais = (v) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Carteira() {
  const [saldo, setSaldo] = useState(carteira.saldo);
  const [aviso, setAviso] = useState(null);

  const minutos = Math.floor(saldo / carteira.precoMinuto);

  const comprar = (valor) => {
    // ============================================================
    // TODO: GATEWAY DE PAGAMENTO ENTRA AQUI
    // Ex.: criar checkout no Mercado Pago / Stripe / Asaas e
    // redirecionar o usuário. O crédito real deve ser lançado no
    // backend, via webhook do gateway (pagamento confirmado).
    // ============================================================
    setSaldo((s) => s + valor); // simulação para demonstração
    setAviso(`Recarga de ${reais(valor)} simulada. Conecte o gateway de pagamento para cobrar de verdade.`);
  };

  return (
    <>
      <PageHeader
        titulo="Carteira"
        subtitulo="Modelo pré-pago: você só paga pelos minutos que a IA fala."
      />

      {/* Saldo em destaque */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(32rem 16rem at 85% -20%, rgba(139,92,246,0.16), transparent), radial-gradient(28rem 14rem at 0% 120%, rgba(62,123,250,0.14), transparent)",
          }}
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Saldo atual
          </p>
          <p className="mt-2 bg-gradient-to-r from-white via-blue-200 to-violet-300 bg-clip-text font-display text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
            {reais(saldo)}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            ≈ {minutos} minutos de ligação · {reais(carteira.precoMinuto)}/minuto
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400">
            <Zap size={13} className="text-brand-blue" />
            Consumo do mês: {reais(carteira.consumoMes)}
          </p>
        </div>
      </section>

      {aviso && (
        <div className="card mt-4 flex items-start gap-3 border-emerald-500/30 p-4 text-sm">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-400" />
          <p className="text-slate-400">{aviso}</p>
        </div>
      )}

      {/* Pacotes de recarga */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-white">Adicionar saldo</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {pacotes.map((p) => {
            const min = Math.floor((p.valor / carteira.precoMinuto) * (p.bonus ? (p.valor === 500 ? 1.15 : 1.05) : 1));
            return (
              <div
                key={p.valor}
                className={`card relative p-5 ${p.tag === "Mais popular" ? "ring-1 ring-brand-blue/50" : ""}`}
              >
                {p.tag && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {p.tag}
                  </span>
                )}
                <p className="font-display text-2xl font-semibold text-white">{reais(p.valor)}</p>
                <p className="mt-1 text-sm text-slate-400">≈ {min} minutos</p>
                {p.bonus && <p className="mt-0.5 text-xs text-emerald-400">{p.bonus}</p>}
                <button onClick={() => comprar(p.valor)} className="btn-primario mt-4 w-full">
                  Adicionar {reais(p.valor)}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Pagamento via Pix ou cartão — pronto para receber o gateway (Mercado Pago, Stripe ou Asaas).
        </p>
      </section>

      {/* Extrato */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-white">Extrato</h2>
        <div className="card divide-y divide-white/5">
          {transacoes.map((t, i) => {
            const recarga = t.valor > 0;
            return (
              <div key={i} className="flex items-center gap-4 p-4">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    recarga ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-slate-400"
                  }`}
                >
                  {recarga ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-200">{t.descricao}</p>
                  <p className="text-xs text-slate-500">
                    {t.data}
                    {t.minutos ? ` · ${t.minutos} minutos falados` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${
                    recarga ? "text-emerald-400" : "text-slate-300"
                  }`}
                >
                  {recarga ? "+" : ""}
                  {reais(t.valor)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
