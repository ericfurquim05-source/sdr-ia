"use client";

import {
  Phone, CheckCircle2, PhoneOff, Wallet, Clock, ListChecks,
  CalendarCheck, Percent, Target, MessageCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/Interface";
import FiltroPeriodo from "@/components/FiltroPeriodo";

/*
 * Parte visual do Dashboard. Recebe os números REAIS por props,
 * já filtrados pelo período escolhido no FiltroPeriodo.
 */
export default function DashboardGraficos({ kpis, serie, desfechos, de, ate }) {
  const brl = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Linha 1 — volume e gasto
  const cardsVolume = [
    { titulo: "Ligações", valor: kpis.total, icone: Phone, cor: "text-brand-blue" },
    { titulo: "Atendidas (>13s)", valor: kpis.atendidas, icone: CheckCircle2, cor: "text-emerald-400" },
    { titulo: "Não atendidas", valor: kpis.nao_atendidas, icone: PhoneOff, cor: "text-slate-400" },
    { titulo: "Investido", valor: brl(kpis.custo), icone: Wallet, cor: "text-brand-violet" },
  ];

  // Linha 2 — RESULTADO: é aqui que se mede o retorno da campanha
  const cardsResultado = [
    {
      titulo: "Reuniões agendadas",
      valor: kpis.reunioes,
      icone: CalendarCheck,
      cor: "text-brand-violet",
      nota: kpis.conversao ? `${kpis.conversao}% das atendidas` : null,
    },
    {
      titulo: "Custo por reunião",
      valor: kpis.custoPorReuniao != null ? brl(kpis.custoPorReuniao) : "—",
      icone: Target,
      cor: "text-amber-400",
      nota: "investido ÷ reuniões",
    },
    {
      titulo: "Taxa de atendimento",
      valor: `${kpis.taxaAtendimento}%`,
      icone: Percent,
      cor: "text-brand-blue",
      nota: `${kpis.contatos_unicos} contatos únicos`,
    },
    {
      titulo: "Duração média",
      valor: `${Math.floor(kpis.duracaoMediaSeg / 60)}:${String(kpis.duracaoMediaSeg % 60).padStart(2, "0")}`,
      icone: Clock,
      cor: "text-cyan-400",
      nota: `${kpis.whatsapps} WhatsApps enviados`,
    },
  ];

  return (
    <>
      <PageHeader titulo="Dashboard" subtitulo="Resultados reais da sua prospecção por voz.">
        <FiltroPeriodo de={de} ate={ate} />
        <a
          href={`/api/relatorio/ligacoes?de=${de}&ate=${ate}`}
          className="btn-fantasma text-sm"
          download
        >
          Exportar planilha
        </a>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cardsVolume.map((c) => (
          <div key={c.titulo} className="card p-4">
            <c.icone size={18} className={c.cor} />
            <p className="mt-3 font-display text-3xl font-bold text-white">{c.valor}</p>
            <p className="mt-1 text-xs text-slate-500">{c.titulo}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cardsResultado.map((c) => (
          <div key={c.titulo} className="card border-white/10 p-4">
            <c.icone size={18} className={c.cor} />
            <p className="mt-3 font-display text-3xl font-bold text-white">{c.valor}</p>
            <p className="mt-1 text-xs text-slate-500">{c.titulo}</p>
            {c.nota && <p className="mt-0.5 text-xs text-slate-600">{c.nota}</p>}
          </div>
        ))}
      </div>

      {/* Situação da fila AGORA (independente do período) */}
      <div className="card mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-2 text-slate-300">
          <ListChecks size={15} className="text-brand-blue" /> Fila agora:
        </span>
        <span className="text-slate-400"><b className="text-white">{kpis.fila.em_ligacao}</b> em ligação</span>
        <span className="text-slate-400"><b className="text-white">{kpis.fila.pendentes}</b> aguardando</span>
        <span className="text-slate-400"><b className="text-emerald-300">{kpis.fila.concluidas}</b> concluídas</span>
        <span className="text-slate-400"><b className="text-slate-300">{kpis.fila.esgotados}</b> esgotadas</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
          <MessageCircle size={13} /> {kpis.minutosFalados} min falados no período
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Evolução no período</h2>
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

        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-white">Desfecho das ligações</h2>
          {desfechos.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma ligação neste período. Ajuste o filtro ou suba uma lista em Campanhas.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {desfechos.map((d) => {
                const total = desfechos.reduce((s, x) => s + x.total, 0) || 1;
                return (
                  <div key={d.rotulo}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-400">{d.rotulo}</span>
                      <span className="font-semibold text-white">{d.total}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-navy-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(d.total / total) * 100}%`, background: d.cor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
