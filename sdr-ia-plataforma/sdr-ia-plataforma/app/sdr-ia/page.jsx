"use client";

import { useState } from "react";
import { Search, ChevronDown, Sparkles, MicOff } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/Interface";
import AudioPlayer from "@/components/AudioPlayer";
import { chamadas } from "@/lib/dados";

const filtros = ["Todas", "Reunião agendada", "Atendida", "Não atendida"];

export default function HistoricoSdrIa() {
  const [filtro, setFiltro] = useState("Todas");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState(chamadas[0]?.id ?? null);

  const lista = chamadas.filter((c) => {
    const bateFiltro = filtro === "Todas" || c.status === filtro;
    const texto = `${c.nome} ${c.empresa} ${c.numero}`.toLowerCase();
    return bateFiltro && texto.includes(busca.toLowerCase());
  });

  return (
    <>
      <PageHeader
        titulo="SDR IA"
        subtitulo="Histórico das ligações feitas pela IA — gravação, resumo e transcrição."
      />

      {/* Busca e filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, empresa ou número"
            className="campo !pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filtros.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                filtro === f
                  ? "bg-gradient-to-r from-brand-blue to-brand-violet text-white"
                  : "border border-white/10 text-slate-400 hover:bg-white/5"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de chamadas */}
      <div className="space-y-3">
        {lista.map((c) => {
          const expandida = aberta === c.id;
          return (
            <article key={c.id} className="card overflow-hidden">
              {/* Cabeçalho do registro */}
              <button
                onClick={() => setAberta(expandida ? null : c.id)}
                className="flex w-full flex-wrap items-center gap-3 p-4 text-left transition hover:bg-white/[0.03] sm:gap-4 sm:p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy-700 to-navy-800 font-display text-sm font-semibold text-slate-200">
                  {c.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-white">
                    {c.nome} <span className="font-normal text-slate-500">· {c.empresa}</span>
                  </span>
                  <span className="block text-sm text-slate-500">
                    {c.numero} · {c.horario} · {c.duracao}
                  </span>
                </span>
                <StatusBadge status={c.status} />
                <ChevronDown
                  size={17}
                  className={`text-slate-500 transition-transform ${expandida ? "rotate-180" : ""}`}
                />
              </button>

              {/* Detalhes: player, resumo e transcrição */}
              {expandida && (
                <div className="grid gap-5 border-t border-white/5 p-4 sm:p-5 lg:grid-cols-2">
                  <div className="space-y-4">
                    {c.duracaoSegundos > 0 ? (
                      <AudioPlayer src={c.recordingUrl} duracaoSegundos={c.duracaoSegundos} />
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-navy-900 px-4 py-3 text-sm text-slate-500">
                        <MicOff size={16} /> Sem gravação — ligação não atendida
                      </div>
                    )}

                    <div className="rounded-xl border-l-2 border-brand-violet bg-navy-900 p-4">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-violet-300">
                        <Sparkles size={12} /> Resumo da IA
                      </p>
                      <p className="text-sm leading-relaxed text-slate-300">{c.resumo}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-navy-900 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
                      Transcrição
                    </p>
                    {c.transcricao.length > 0 ? (
                      <ul className="max-h-56 space-y-3 overflow-y-auto pr-2 text-sm">
                        {c.transcricao.map((t, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span
                              className={`shrink-0 font-semibold ${
                                t.quem === "IA" ? "text-brand-violet" : "text-brand-blue"
                              }`}
                            >
                              {t.quem}:
                            </span>
                            <span className="text-slate-300">{t.fala}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">
                        A transcrição fica disponível quando a ligação é atendida.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {lista.length === 0 && (
          <div className="card p-10 text-center text-sm text-slate-500">
            Nenhuma ligação encontrada com esses filtros. Ajuste a busca ou execute uma nova campanha.
          </div>
        )}
      </div>
    </>
  );
}
