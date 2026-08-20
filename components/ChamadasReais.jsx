"use client";

import { useState } from "react";
import { Search, Sparkles, Play, Pause } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/Interface";

/*
 * Lista de chamadas REAIS (tabela ligacoes): player com a gravação
 * da Retell, resumo da IA e transcrição completa.
 */

function PlayerReal({ url }) {
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio(url) : null));
  const [tocando, setTocando] = useState(false);

  const alternar = () => {
    if (!audio) return;
    if (tocando) {
      audio.pause();
      setTocando(false);
    } else {
      audio.play();
      setTocando(true);
      audio.onended = () => setTocando(false);
    }
  };

  return (
    <button
      onClick={alternar}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-navy-900 px-3 py-2 text-sm text-slate-300 transition hover:border-brand-blue/50"
    >
      {tocando ? <Pause size={14} /> : <Play size={14} />}
      {tocando ? "Pausar gravação" : "Ouvir gravação"}
    </button>
  );
}

// A Retell manda a transcrição como texto "Agent: ...\nUser: ..."
function Transcricao({ texto }) {
  const linhas = String(texto)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-xl border border-white/5 bg-navy-900 p-3">
      {linhas.map((linha, i) => {
        const ehIA = /^(agent|assistant|ia)\s*:/i.test(linha);
        const ehLead = /^(user|lead|cliente)\s*:/i.test(linha);
        const conteudo = linha.replace(/^(agent|assistant|ia|user|lead|cliente)\s*:\s*/i, "");
        return (
          <p key={i} className="text-sm leading-relaxed text-slate-300">
            {(ehIA || ehLead) && (
              <span className={`font-semibold ${ehIA ? "text-brand-violet" : "text-brand-blue"}`}>
                {ehIA ? "IA" : "Lead"}:{" "}
              </span>
            )}
            {conteudo}
          </p>
        );
      })}
    </div>
  );
}

export default function ChamadasReais({ ligacoes }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("Todas");
  const [aberto, setAberto] = useState(ligacoes[0]?.id ?? null);

  const chips = ["Todas", "Atendida", "Não atendida"];

  const statusDe = (l) => (l.sucesso ? "Atendida" : "Não atendida");

  const lista = ligacoes.filter((l) => {
    const okFiltro = filtro === "Todas" || statusDe(l) === filtro;
    const okBusca = (l.nome + " " + l.telefone).toLowerCase().includes(busca.toLowerCase());
    return okFiltro && okBusca;
  });

  const fmtHora = (iso) =>
    new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const fmtDuracao = (ms) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <>
      <PageHeader
        titulo="SDR IA"
        subtitulo="Histórico real das ligações — gravação, resumo e transcrição."
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="campo flex flex-1 items-center gap-2 !py-2.5">
          <Search size={15} className="text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => setFiltro(c)}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs transition ${
                filtro === c
                  ? "bg-gradient-to-r from-brand-blue to-brand-violet text-white"
                  : "border border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">
          Nenhuma ligação registrada ainda. As chamadas aparecem aqui em tempo real
          conforme a campanha roda.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {lista.map((l) => (
          <div key={l.id} className="card overflow-hidden">
            <button
              onClick={() => setAberto(aberto === l.id ? null : l.id)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-navy-800 text-sm font-bold text-slate-300">
                {(l.nome || l.telefone)
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {l.nome || "Sem nome"}{" "}
                  <span className="font-normal text-slate-500">· {l.telefone}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {fmtHora(l.criado_em)} · {fmtDuracao(l.duracao_ms)} · {l.motivo}
                </p>
              </div>
              <StatusBadge status={l.sucesso ? "Atendida" : "Não atendida"} />
            </button>

            {aberto === l.id && (
              <div className="flex flex-col gap-3 px-4 pb-4">
                {l.recording_url ? (
                  <PlayerReal url={l.recording_url} />
                ) : (
                  <p className="text-xs italic text-slate-500">
                    Sem gravação disponível para esta chamada.
                  </p>
                )}

                {l.resumo && (
                  <div className="rounded-xl border border-brand-violet/30 bg-brand-violet/10 p-3">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-brand-violet">
                      <Sparkles size={12} /> Resumo da IA
                    </p>
                    <p className="text-sm leading-relaxed text-slate-200">{l.resumo}</p>
                  </div>
                )}

                {l.transcript && <Transcricao texto={l.transcript} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
