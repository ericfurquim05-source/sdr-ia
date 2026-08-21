"use client";

import { Phone, Headset, Clock, ListChecks, CalendarCheck, Percent, Coins } from "lucide-react";
import { PageHeader } from "@/components/Interface";
import FiltroPeriodo from "@/components/FiltroPeriodo";
import PainelAoVivo from "@/components/PainelAoVivo";

/*
 * DASHBOARD — hierarquia visual em três níveis:
 *  1. Painel ao vivo (o que está acontecendo agora)
 *  2. Tríade de performance (volume, sucesso, engajamento)
 *  3. Métricas de resultado e eficiência
 * O gráfico de evolução foi removido: com pouco histórico ele
 * ocupava espaço nobre sem entregar leitura útil.
 */

const KPIS_VAZIO = {
  total: 0, atendidas: 0, nao_atendidas: 0, custo: 0, contatos_unicos: 0,
  minutosFalados: 0, duracaoMediaSeg: 0, taxaAtendimento: 0,
  reunioes: 0, conversao: 0, custoPorReuniao: null, whatsapps: 0,
  fila: { pendentes: 0, em_ligacao: 0, concluidas: 0, esgotados: 0 },
};

export default function DashboardGraficos({
  kpis: kpisRecebido,
  desfechos = [],
  de,
  ate,
  horas = null,
  aoVivo = null,
}) {
  const kpis = {
    ...KPIS_VAZIO,
    ...(kpisRecebido ?? {}),
    fila: { ...KPIS_VAZIO.fila, ...(kpisRecebido?.fila ?? {}) },
  };

  const brl = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const dataHoje = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Métrica financeira principal: eficiência, não gasto bruto
  const custoMedio = kpis.total > 0 ? kpis.custo / kpis.total : 0;
  const duracaoMedia = `${Math.floor(kpis.duracaoMediaSeg / 60)}:${String(
    kpis.duracaoMediaSeg % 60
  ).padStart(2, "0")}`;

  const totalDesfechos = desfechos.reduce((soma, d) => soma + d.total, 0) || 1;

  return (
    <>
      <PageHeader titulo="Dashboard" subtitulo={`Resultados da sua prospecção · ${dataHoje}`}>
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

      {/* TRÍADE DE PERFORMANCE — o que o olho precisa capturar primeiro */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card bg-navy-850 p-6">
          <Phone size={20} className="mb-4 text-brand-blue" />
          <p className="font-display text-5xl font-bold leading-none text-white">{kpis.total}</p>
          <p className="mt-3 text-sm font-semibold text-slate-200">Ligações feitas</p>
          <p className="mt-0.5 text-xs text-slate-500">{kpis.contatos_unicos} contatos únicos</p>
        </div>

        <div className="card bg-navy-850 p-6">
          <Headset size={20} className="mb-4 text-emerald-400" />
          <p className="font-display text-5xl font-bold leading-none text-emerald-300">
            {kpis.atendidas}
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-200">Atendimentos</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {kpis.taxaAtendimento}% de taxa de atendimento
          </p>
        </div>

        <div className="card bg-navy-850 p-6">
          <Clock size={20} className="mb-4 text-cyan-400" />
          <p className="font-display text-5xl font-bold leading-none text-white">{duracaoMedia}</p>
          <p className="mt-3 text-sm font-semibold text-slate-200">Tempo médio</p>
          <p className="mt-0.5 text-xs text-slate-500">{kpis.minutosFalados} min falados no total</p>
        </div>
      </div>

      {/* RESULTADO E EFICIÊNCIA */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-5">
          <Coins size={17} className="mb-3 text-brand-violet" />
          <p className="font-display text-3xl font-bold text-white">{brl(custoMedio)}</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-300">Custo médio</p>
          <p className="text-xs text-slate-500">por ligação realizada</p>
        </div>

        <a href="/reunioes" className="card p-5 transition hover:border-brand-violet/50">
          <CalendarCheck size={17} className="mb-3 text-brand-violet" />
          <p className="font-display text-3xl font-bold text-white">{kpis.reunioes}</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-300">Reuniões agendadas</p>
          <p className="text-xs text-slate-500">
            {kpis.conversao ? `${kpis.conversao}% das atendidas` : "pela IA"}
          </p>
        </a>

        <div className="card p-5">
          <Percent size={17} className="mb-3 text-amber-400" />
          <p className="font-display text-3xl font-bold text-white">
            {kpis.custoPorReuniao != null ? brl(kpis.custoPorReuniao) : "—"}
          </p>
          <p className="mt-1.5 text-sm font-semibold text-slate-300">Custo por reunião</p>
          <p className="text-xs text-slate-500">investido ÷ reuniões</p>
        </div>

        <div className="card p-5">
          <Coins size={17} className="mb-3 text-slate-400" />
          <p className="font-display text-3xl font-bold text-white">{brl(kpis.custo)}</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-300">Total do período</p>
          <p className="text-xs text-slate-500">{kpis.whatsapps} WhatsApps enviados</p>
        </div>
      </div>

      {/* FILA AGORA — negrito só nos números, para leitura instantânea */}
      <div className="card mb-4 flex flex-wrap items-center gap-x-7 gap-y-2 p-5 text-sm">
        <span className="flex items-center gap-2 font-semibold text-slate-300">
          <ListChecks size={16} className="text-brand-blue" /> Fila agora
        </span>
        <span className="text-slate-500">
          <b className="text-base font-bold text-white">{kpis.fila.em_ligacao}</b> em ligação
        </span>
        <span className="text-slate-500">
          <b className="text-base font-bold text-white">{kpis.fila.pendentes}</b> aguardando
        </span>
        <span className="text-slate-500">
          <b className="text-base font-bold text-emerald-300">{kpis.fila.concluidas}</b> concluídas
        </span>
        <span className="text-slate-500">
          <b className="text-base font-bold text-slate-300">{kpis.fila.esgotados}</b> esgotadas
        </span>
      </div>

      {/* DESFECHOS — largura total agora que o gráfico saiu */}
      <div className="card p-6">
        <h2 className="mb-5 font-semibold text-white">Desfecho das ligações</h2>

        {desfechos.length === 0 ? (
          <div className="flex flex-col gap-2 py-2">
            <p className="text-sm text-slate-400">Nenhuma ligação neste período.</p>
            <p className="max-w-lg text-xs leading-relaxed text-slate-600">
              Aqui você vai ver como cada ligação terminou: atendida, caixa postal, não
              atendida ou erro de operadora — para saber onde a campanha está travando.
            </p>
            <a href="/campanhas" className="btn-primario mt-2 self-start !py-2 text-xs">
              Subir minha primeira lista
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {desfechos.map((d) => (
              <div key={d.rotulo}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-slate-300">{d.rotulo}</span>
                  <span className="text-sm">
                    <b className="font-bold text-white">{d.total}</b>
                    <span className="ml-1.5 text-xs text-slate-500">
                      {Math.round((d.total / totalDesfechos) * 100)}%
                    </span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-navy-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(d.total / totalDesfechos) * 100}%`, background: d.cor }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
