"use client";

import {
  Phone, CheckCircle2, PhoneOff, Wallet, Clock, ListChecks,
  CalendarCheck, Percent, Target, MessageCircle, Sparkles, UserRound,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/Interface";
import FiltroPeriodo from "@/components/FiltroPeriodo";
import PainelAoVivo from "@/components/PainelAoVivo";

/*
 * Parte visual do Dashboard. Recebe os números REAIS por props,
 * já filtrados pelo período escolhido no FiltroPeriodo.
 */
// Referências do comparativo com SDR humano
const LIGACOES_HUMANO = 60;     // ligações por dia de um SDR dedicado
const CUSTO_DIA_HUMANO = 150;   // salário + encargos, por dia útil

export default function DashboardGraficos({ kpis, serie, desfechos, de, ate, horas, aoVivo }) {
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
        <FiltroPeriodo de={de} ate={ate} horas={horas} />
        <a
          href={`/api/relatorio/ligacoes?de=${de}&ate=${ate}${horas ? `&horas=${horas}` : ""}`}
          className="btn-fantasma text-sm"
          download
        >
          Exportar planilha
        </a>
      </PageHeader>

      <PainelAoVivo inicial={aoVivo} />

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
        {cardsResultado.map((c) => {
          const Card = c.titulo === "Reuniões agendadas" ? "a" : "div";
          return (
          <Card
            key={c.titulo}
            {...(c.titulo === "Reuniões agendadas" ? { href: "/reunioes" } : {})}
            className={`card border-white/10 p-4 ${
              c.titulo === "Reuniões agendadas" ? "transition hover:border-brand-violet/50" : ""
            }`}
          >
            <c.icone size={18} className={c.cor} />
            <p className="mt-3 font-display text-3xl font-bold text-white">{c.valor}</p>
            <p className="mt-1 text-xs text-slate-500">{c.titulo}</p>
            {c.nota && <p className="mt-0.5 text-xs text-slate-600">{c.nota}</p>}
          </Card>
          );
        })}
      </div>

      {/* Comparativo com SDR humano — o card que explica o valor */}
      {kpis.total > 0 && (
        <div className="card mb-6 overflow-hidden border-emerald-500/20">
          <div className="grid gap-px bg-white/5 sm:grid-cols-[1fr_auto_1fr]">
            {/* Lado da IA */}
            <div className="bg-navy-850 p-5">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                <Sparkles size={12} /> Com a IA
              </p>
              <p className="font-display text-4xl font-bold text-white">{kpis.total}</p>
              <p className="mt-1 text-sm text-slate-400">
                ligações em {diasIA === 1 ? "1 dia" : `${diasIA} dias`}
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-emerald-300">
                {brl(kpis.custo)}
              </p>
              <p className="text-xs text-slate-500">custo total, só minutos falados</p>
            </div>

            {/* Divisor */}
            <div className="flex items-center justify-center bg-navy-850 px-4 py-2">
              <span className="font-display text-sm font-bold text-slate-600">VS</span>
            </div>

            {/* Lado do SDR humano */}
            <div className="bg-navy-900 p-5">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <UserRound size={12} /> Com um SDR contratado
              </p>
              <p className="font-display text-4xl font-bold text-slate-400">{kpis.total}</p>
              <p className="mt-1 text-sm text-slate-500">
                ligações em {diasHumano === 1 ? "1 dia" : `${diasHumano} dias`} ({LIGACOES_HUMANO}/dia)
              </p>
              <p className="mt-3 font-display text-2xl font-semibold text-slate-400">
                {brl(custoHumano)}
              </p>
              <p className="text-xs text-slate-600">proporcional a salário e encargos</p>
            </div>
          </div>

          {economia > 0 && (
            <p className="bg-emerald-500/10 px-5 py-3 text-center text-sm text-emerald-300">
              Economia de <b>{brl(economia)}</b> no período — e a IA não tira férias, não
              falta e trabalha em paralelo.
            </p>
          )}
        </div>
      )}

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
            <h2 className="font-semibold text-white">
              {horas ? `Últimas ${horas}h, hora a hora` : "Evolução no período"}
            </h2>
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
            <div className="flex flex-col gap-2 py-4">
              <p className="text-sm text-slate-400">Nenhuma ligação neste período.</p>
              <p className="text-xs leading-relaxed text-slate-600">
                Aqui você vai ver como cada ligação terminou: atendida, caixa postal, não
                atendida ou erro de operadora — para saber onde a campanha está travando.
              </p>
              <a href="/campanhas" className="btn-primario mt-2 self-start !py-2 text-xs">
                Subir minha primeira lista
              </a>
            </div>
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
