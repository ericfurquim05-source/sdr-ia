"use client";

import { useState } from "react";
import { Sparkles, Clock } from "lucide-react";
import { PageHeader } from "@/components/Interface";

/*
 * Grade mensal com os eventos reais recebidos por props.
 * Dots violeta = reunião marcada pela IA · azul = manual.
 * Fins de semana aparecem bloqueados (fora do horário de atendimento).
 */
export default function CalendarioGrade({ eventos }) {
  const hoje = new Date();
  const [mesBase, setMesBase] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSel, setDiaSel] = useState(hoje.getDate());

  const ano = mesBase.getFullYear();
  const mes = mesBase.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const nomeMes = mesBase.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Agrupa os eventos por dia do mês exibido
  const porDia = new Map();
  for (const e of eventos) {
    const d = new Date(e.inicio);
    if (d.getFullYear() === ano && d.getMonth() === mes) {
      const dia = d.getDate();
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia).push(e);
    }
  }

  const celulas = [...Array(primeiroDia).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)];
  const evDia = (porDia.get(diaSel) ?? []).sort((a, b) => a.inicio.localeCompare(b.inicio));

  const mudarMes = (delta) => {
    setMesBase(new Date(ano, mes + delta, 1));
    setDiaSel(1);
  };

  const fmtHora = (iso) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <PageHeader
        titulo="Calendário"
        subtitulo="Reuniões marcadas pela IA entram aqui sozinhas, em violeta."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold capitalize text-white">{nomeMes}</p>
            <div className="flex gap-2">
              <button onClick={() => mudarMes(-1)} className="btn-fantasma !px-3 !py-1.5">‹</button>
              <button onClick={() => mudarMes(1)} className="btn-fantasma !px-3 !py-1.5">›</button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {celulas.map((d, i) => {
              if (!d) return <div key={i} />;
              const dow = new Date(ano, mes, d).getDay();
              const bloqueado = dow === 0; // só domingo bloqueado
              const tem = porDia.get(d);
              const selecionado = d === diaSel;
              const ehHoje =
                d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();

              return (
                <button
                  key={i}
                  disabled={bloqueado}
                  onClick={() => setDiaSel(d)}
                  className={`relative h-11 rounded-lg text-sm transition
                    ${bloqueado ? "cursor-not-allowed text-slate-700" : "text-slate-300 hover:bg-navy-800"}
                    ${selecionado ? "bg-gradient-to-br from-brand-blue to-brand-violet font-semibold text-white" : ""}
                    ${ehHoje && !selecionado ? "border border-brand-blue" : ""}`}
                >
                  {d}
                  {tem && (
                    <span
                      className={`absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                        tem[0].origem === "ia" ? "bg-brand-violet" : "bg-brand-blue"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Clock size={12} /> Atendimento: segunda a sábado, 08h às 21h — domingos bloqueados
          </p>
        </div>

        <div className="card p-5">
          <p className="mb-4 font-semibold text-white">Dia {diaSel}</p>
          {evDia.length === 0 && (
            <p className="text-sm text-slate-500">Nenhum compromisso neste dia.</p>
          )}
          <div className="flex flex-col gap-3">
            {evDia.map((e) => (
              <div
                key={e.id}
                className={`rounded-xl border p-3 ${
                  e.origem === "ia"
                    ? "border-brand-violet/35 bg-brand-violet/10"
                    : "border-white/10 bg-navy-800"
                }`}
              >
                <p className="mb-1 text-xs font-semibold text-slate-300">{fmtHora(e.inicio)}</p>
                <p className="text-sm leading-snug text-white">{e.titulo}</p>
                {e.telefone && <p className="mt-1 text-xs text-slate-500">{e.telefone}</p>}
                {e.origem === "ia" && (
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-violet">
                    <Sparkles size={11} /> Agendado pela IA
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
