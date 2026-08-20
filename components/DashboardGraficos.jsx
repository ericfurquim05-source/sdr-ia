"use client";

import {
  Phone, CheckCircle2, PhoneOff, Wallet, ArrowUpRight, Clock, ListChecks,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/Interface";

/*
 * Parte visual do Dashboard. Recebe os números REAIS por props
 * (calculados no servidor a partir da tabela de ligações).
 */
export default function DashboardGraficos({ kpis, serie, desfechos }) {
  const brl = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const dataHoje = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const cards = [
    { titulo: "Ligações hoje", valor: kpis.total, icone: Phone, cor: "text-brand-blue" },
    { titulo: "Atendidas (>13s)", valor: kpis.atendidas, icone: CheckCircle2, cor: "text-emerald-400" },
    { titulo: "Não atendidas", valor: kpis.nao_atendidas, icone: PhoneOff, cor: "text-slate-400" },
    { titulo: "Gasto hoje", valor: brl(kpis.custo), icone: Wallet, cor: "text-brand-violet" },
  ];

  const totalDesfechos = desfechos.reduce((soma, d) => soma + d.total, 0) || 1;

  return (
    <>
      <PageHeader titulo="Dashboard" subtitulo={`Acompanhamento em tempo real · ${dataHoje}`}>
        <a href="/api/relatorio/ligacoes" className="btn-fantasma text-sm" download>
          Exportar planilha
        </a>
      </PageHeader>

      {/* KPIs do dia — direto da tabela de ligações */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.titulo} className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <c.icone size={18} className={c.cor} />
            </div>
            <p className="font-display text-3xl font-bold text-white">{c.valor}</p>
            <p className="mt-1 text-xs text-slate-500">{c.titulo}</p>
          </div>
        ))}
      </div>

      {/* Situação da fila agora */}
      <div className="card mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-2 text-slate-300">
          <ListChecks size={15} className="text-brand-blue" /> Fila agora:
        </span>
        <span className="text-slate-400">
          <b className="text-white">{kpis.fila.em_ligacao}</b> em ligação
        </span>
        <span className="text-slate-400">
          <b className="text-white">{kpis.fila.pendentes}</b> aguardando
        </span>
        <span className="text-slate-400">
          <b className="text-emerald-300">{kpis.fila.concluidas}</b> concluídas
        </span>
        <span className="text-slate-400">
          <b className="text-slate-300">{kpis.fila.esgotados}</b> esgotadas (7 tentativas)
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
          <Clock size={13} /> {kpis.minutosFalados} min falados hoje
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Últimos 7 dias */}
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Últimos 7 dias</h2>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-blue" /> Ligações
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Atendidas
              </span>
            </div>
          </div>
          <div style={{ width: "100%", height: 230 }}>
            <ResponsiveContainer>
              <AreaChart data={serie} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gLig" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3E7BFA" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3E7BFA" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAte" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#16233C" vertical={false} />
                <XAxis dataKey="dia" tick={{ fill: "#7C8DB0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#7C8DB0", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0D1728", border: "1px solid #1B2C4A", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "#E6ECF7" }}
                  formatter={(valor, nome) => [valor, nome === "ligacoes" ? "Ligações" : "Atendidas"]}
                />
                <Area type="monotone" dataKey="ligacoes" stroke="#3E7BFA" strokeWidth={2} fill="url(#gLig)" />
                <Area type="monotone" dataKey="atendidas" stroke="#34D399" strokeWidth={2} fill="url(#gAte)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Desfechos de hoje */}
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-white">Desfecho das ligações de hoje</h2>
          {desfechos.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma ligação registrada hoje ainda. Suba uma lista em Campanhas para começar.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {desfechos.map((d) => (
                <div key={d.rotulo}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-400">{d.rotulo}</span>
                    <span className="font-semibold text-white">{d.total}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-navy-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(d.total / totalDesfechos) * 100}%`, background: d.cor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 flex items-center gap-1 text-xs text-slate-600">
            <ArrowUpRight size={12} /> Atualiza a cada visita — recarregue para os números mais novos.
          </p>
        </div>
      </div>
    </>
  );
}
