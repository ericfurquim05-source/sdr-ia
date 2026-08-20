"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowDownRight, Phone, Sparkles, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/Interface";

/*
 * Carteira REAL: saldo e extrato vêm do banco por props.
 * Recarga mínima R$ 200 · bônus exclusivo: +7% a partir de R$ 3.000
 * Quanto maior a recarga, menor o custo por minuto na prática.
 */

const MINIMO = 200;

function bonusDe(v) {
  return v >= 3000 ? 7 : 0;
}

const PACOTES = [
  { valor: 500, selo: null },
  { valor: 1000, selo: "Mais popular" },
  { valor: 2000, selo: null },
  { valor: 3000, selo: "+7% de bônus" },
  { valor: 5000, selo: "+7% de bônus" },
];

export default function CarteiraCliente({ saldo, precoMinuto, consumoMes, extrato }) {
  const router = useRouter();
  const [personalizado, setPersonalizado] = useState("");
  const [enviando, setEnviando] = useState(null); // valor em processamento
  const [aviso, setAviso] = useState(null);

  const brl = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const recarregar = async (valor) => {
    setEnviando(valor);
    setAviso(null);
    try {
      const resposta = await fetch("/api/carteira/recarregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor }),
      });
      const dados = await resposta.json();
      setAviso({ erro: !resposta.ok, texto: dados.mensagem || dados.erro });
      if (resposta.ok) {
        setPersonalizado("");
        router.refresh(); // atualiza saldo na tela e na sidebar
      }
    } catch {
      setAviso({ erro: true, texto: "Falha de conexão. Tente novamente." });
    } finally {
      setEnviando(null);
    }
  };

  const vPers = Number(personalizado) || 0;
  const pPers = bonusDe(vPers);

  return (
    <>
      <PageHeader
        titulo="Carteira"
        subtitulo="Modelo pré-pago: você só paga pelos minutos que a IA fala."
      />

      {/* Saldo real */}
      <div className="card mb-6 border-brand-blue/20 bg-gradient-to-br from-navy-850 to-navy-800 p-6">
        <p className="mb-1 text-xs uppercase tracking-wider text-slate-500">Saldo atual</p>
        <p className="bg-gradient-to-r from-white to-blue-300 bg-clip-text font-display text-5xl font-bold text-transparent">
          {brl(saldo)}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          ≈ {Math.max(Math.floor(saldo / precoMinuto), 0)} minutos de ligação · {brl(precoMinuto)}/minuto
          {consumoMes > 0 && <> · consumo do mês: {brl(consumoMes)}</>}
        </p>
      </div>

      {/* Pacotes com bônus progressivo */}
      <div className="mb-3 flex items-end justify-between">
        <p className="text-sm font-semibold text-white">Adicionar saldo</p>
        <p className="text-xs text-slate-500">Mínimo R$ 200 · +7% de bônus a partir de R$ 3.000</p>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {PACOTES.map((p) => {
          const pct = bonusDe(p.valor);
          const bonus = (p.valor * pct) / 100;
          return (
            <div
              key={p.valor}
              className={`card relative p-4 ${p.selo ? "border-brand-violet/50" : ""}`}
            >
              {p.selo && (
                <span className="absolute -top-2.5 left-3 rounded-full bg-gradient-to-r from-brand-blue to-brand-violet px-2 py-0.5 text-xs font-semibold text-white">
                  {p.selo}
                </span>
              )}
              <p className="font-display text-2xl font-bold text-white">{brl(p.valor)}</p>
              {pct > 0 ? (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-emerald-400">
                  <Sparkles size={11} /> +{pct}% = {brl(p.valor + bonus)}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-slate-500">
                  ≈ {Math.floor(p.valor / precoMinuto)} minutos
                </p>
              )}
              <button
                onClick={() => recarregar(p.valor)}
                disabled={enviando !== null}
                className="btn-primario mt-3 w-full !py-2 text-xs"
              >
                {enviando === p.valor ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Adicionar
              </button>
            </div>
          );
        })}
      </div>

      {/* Valor livre — a régua de bônus se aplica sozinha */}
      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Outro valor</p>
          <p className="text-xs text-slate-500">
            A partir de <b className="text-emerald-400">R$ 3.000</b>, você ganha{" "}
            <b className="text-emerald-400">+7% de bônus</b> na recarga
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={MINIMO}
            step={50}
            value={personalizado}
            onChange={(e) => setPersonalizado(e.target.value)}
            placeholder={`mín. ${MINIMO}`}
            className="campo w-32 text-sm"
          />
          {vPers >= MINIMO && pPers > 0 && (
            <span className="whitespace-nowrap text-xs font-semibold text-emerald-400">
              +{pPers}% → {brl(vPers * (1 + pPers / 100))}
            </span>
          )}
          <button
            onClick={() => vPers >= MINIMO && recarregar(vPers)}
            disabled={enviando !== null || vPers < MINIMO}
            className="btn-primario !py-2.5 text-xs"
          >
            Adicionar
          </button>
        </div>
      </div>

      {aviso && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            aviso.erro
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {/* Extrato real */}
      <p className="mb-3 text-sm font-semibold text-white">Extrato</p>
      <div className="card divide-y divide-white/5">
        {extrato.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            Nenhuma movimentação ainda.
          </p>
        )}
        {extrato.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-4">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                t.valor > 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-brand-blue/15 text-blue-300"
              }`}
            >
              {t.valor > 0 ? <ArrowDownRight size={15} /> : <Phone size={14} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{t.descricao}</p>
              <p className="text-xs text-slate-500">
                {new Date(t.criado_em).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${
                t.valor > 0 ? "text-emerald-300" : "text-slate-300"
              }`}
            >
              {t.valor > 0 ? "+" : ""}
              {brl(t.valor)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
