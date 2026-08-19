"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PhoneCall, PhoneIncoming, PhoneMissed, CalendarCheck, Download } from "lucide-react";
import { PageHeader, KpiCard } from "@/components/Interface";
import { kpisHoje, serieSemanal, desfechosHoje } from "@/lib/dados";

export default function Dashboard() {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const taxaAtendimento = Math.round((kpisHoje.atendidas / kpisHoje.total) * 100);

  return (
    <>
      <PageHeader titulo="Dashboard" subtitulo={`Visão geral de hoje — ${hoje}`}>
        <button className="btn-fantasma">
          <Download size={15} /> Exportar relatório
        </button>
      </PageHeader>

      {/* Indicadores do dia */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          rotulo="Ligações feitas hoje"
          valor={kpisHoje.total}
          delta="+12%"
          icone={PhoneCall}
        />
        <KpiCard
          rotulo="Ligações atendidas"
          valor={kpisHoje.atendidas}
          delta="+8%"
          icone={PhoneIncoming}
          corIcone="text-emerald-400"
        />
        <KpiCard
          rotulo="Não atendidas"
          valor={kpisHoje.naoAtendidas}
          delta="-4%"
          positivo={false}
          icone={PhoneMissed}
          corIcone="text-slate-400"
        />
        <KpiCard
          rotulo="Reuniões agendadas pela IA"
          valor={kpisHoje.reunioesIA}
          delta="+3"
          icone={CalendarCheck}
          corIcone="text-brand-violet"
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Gráfico de taxa de atendimento e conversão */}
        <div className="card p-6 lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                Atendimento e conversão
              </h2>
              <p className="text-xs text-slate-500">Últimos 7 dias úteis (%)</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-blue" /> Atendimento
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-violet" /> Conversão
              </span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieSemanal} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAtendimento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3E7BFA" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3E7BFA" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradConversao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    background: "#0D1728",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Area
                  type="monotone"
                  dataKey="atendimento"
                  name="Atendimento"
                  stroke="#3E7BFA"
                  strokeWidth={2}
                  fill="url(#gradAtendimento)"
                />
                <Area
                  type="monotone"
                  dataKey="conversao"
                  name="Conversão"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fill="url(#gradConversao)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Desfecho das ligações de hoje */}
        <div className="card p-6">
          <h2 className="font-display text-lg font-semibold text-white">Desfecho das ligações</h2>
          <p className="text-xs text-slate-500">
            Hoje · taxa de atendimento de {taxaAtendimento}%
          </p>

          <ul className="mt-5 space-y-4">
            {desfechosHoje.map((d) => (
              <li key={d.rotulo}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{d.rotulo}</span>
                  <span className="tabular-nums text-slate-400">{d.qtd}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${d.cor}`}
                    style={{ width: `${(d.qtd / kpisHoje.total) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
