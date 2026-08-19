"use client";

import { useState } from "react";
import { Sparkles, Clock, Lock } from "lucide-react";
import { PageHeader } from "@/components/Interface";
import { eventosAgenda, horarioAtendimento } from "@/lib/dados";

const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Calendario() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const hoje = agora.getDate();

  const [diaSelecionado, setDiaSelecionado] = useState(hoje);

  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const celulas = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  const nomeMes = agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const eventosDoDia = (dia) => eventosAgenda.filter((e) => e.dia === dia);
  const diaBloqueado = (dia) =>
    horarioAtendimento.diasBloqueados.includes(new Date(ano, mes, dia).getDay());

  const proximos = [...eventosAgenda].filter((e) => e.dia >= hoje).sort((a, b) => a.dia - b.dia);

  return (
    <>
      <PageHeader
        titulo="Calendário"
        subtitulo="Reuniões marcadas pela IA aparecem em violeta, automaticamente."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Grade do mês */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-display text-lg font-semibold capitalize text-white">
            {nomeMes}
          </h2>

          <div className="grid grid-cols-7 gap-1.5 text-center">
            {diasSemana.map((d) => (
              <span key={d} className="pb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                {d}
              </span>
            ))}

            {celulas.map((dia, i) => {
              if (dia === null) return <span key={`v-${i}`} />;
              const bloqueado = diaBloqueado(dia);
              const eventos = eventosDoDia(dia);
              const selecionado = dia === diaSelecionado;
              const ehHoje = dia === hoje;

              return (
                <button
                  key={dia}
                  onClick={() => setDiaSelecionado(dia)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition ${
                    selecionado
                      ? "bg-gradient-to-br from-brand-blue/25 to-brand-violet/25 text-white ring-1 ring-brand-blue/50"
                      : bloqueado
                        ? "bg-white/[0.02] text-slate-600"
                        : "text-slate-300 hover:bg-white/5"
                  } ${ehHoje && !selecionado ? "ring-1 ring-inset ring-white/20" : ""}`}
                >
                  <span className={ehHoje ? "font-semibold text-white" : ""}>{dia}</span>
                  {eventos.length > 0 && (
                    <span className="absolute bottom-1.5 flex gap-0.5 sm:bottom-2">
                      {eventos.map((e, j) => (
                        <span
                          key={j}
                          className={`h-1.5 w-1.5 rounded-full ${
                            e.origem === "ia" ? "bg-brand-violet" : "bg-brand-blue"
                          }`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/5 pt-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-violet" /> Agendado pela IA
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-blue" /> Agendado manualmente
            </span>
            <span className="flex items-center gap-1.5">
              <Lock size={11} /> Dia sem atendimento
            </span>
          </div>
        </section>

        {/* Painel lateral */}
        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="font-display font-semibold text-white">
              Dia {diaSelecionado} de {agora.toLocaleDateString("pt-BR", { month: "long" })}
            </h3>

            {diaBloqueado(diaSelecionado) ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Lock size={14} /> Fora do horário de atendimento.
              </p>
            ) : eventosDoDia(diaSelecionado).length > 0 ? (
              <ul className="mt-3 space-y-2.5">
                {eventosDoDia(diaSelecionado).map((e, i) => (
                  <EventoItem key={i} evento={e} />
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Nenhuma reunião neste dia. Horários livres para a IA agendar.
              </p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="flex items-center gap-2 font-display font-semibold text-white">
              <Clock size={15} className="text-brand-blue" /> Horário de atendimento
            </h3>
            <p className="mt-2 text-sm text-slate-400">{horarioAtendimento.descricao}</p>
            <p className="mt-1 text-xs text-slate-500">
              A IA só oferece horários dentro dessa janela durante as ligações.
            </p>
          </div>

          <div className="card p-5">
            <h3 className="font-display font-semibold text-white">Próximos agendamentos</h3>
            <ul className="mt-3 space-y-2.5">
              {proximos.map((e, i) => (
                <EventoItem key={i} evento={e} mostrarDia />
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

function EventoItem({ evento, mostrarDia = false }) {
  const daIA = evento.origem === "ia";
  return (
    <li
      className={`rounded-xl border p-3 text-sm ${
        daIA ? "border-brand-violet/30 bg-brand-violet/5" : "border-white/10 bg-navy-900"
      }`}
    >
      <p className="flex items-center gap-1.5 font-medium text-slate-200">
        {daIA && <Sparkles size={13} className="text-brand-violet" />}
        {mostrarDia && <span className="text-slate-500">dia {evento.dia} ·</span>} {evento.hora}
      </p>
      <p className="mt-0.5 text-slate-400">{evento.titulo}</p>
      {daIA && <p className="mt-1 text-[11px] uppercase tracking-widest text-violet-400">Agendado pela IA</p>}
    </li>
  );
}
