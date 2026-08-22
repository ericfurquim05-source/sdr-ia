"use client";

import { useState } from "react";
import {
  Sparkles, CalendarCheck, Phone, ExternalLink, Clock, ChevronDown,
  NotebookPen, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/Interface";
import PlayerAudio from "@/components/PlayerAudio";
import { formatarExibicao } from "@/lib/planilha";

/*
 * Reuniões agendadas. Cada card abre a conversa que gerou a
 * reunião: gravação, resumo da IA e transcrição completa.
 */

function Transcricao({ texto }) {
  const linhas = String(texto).split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-xl border border-white/5 bg-navy-900 p-3">
      {linhas.map((linha, i) => {
        const ehIA = /^(agent|assistant|ia|lara)\s*:/i.test(linha);
        const ehLead = /^(user|lead|cliente)\s*:/i.test(linha);
        const conteudo = linha.replace(/^(agent|assistant|ia|lara|user|lead|cliente)\s*:\s*/i, "");
        return (
          <p key={i} className="text-sm leading-relaxed text-slate-300">
            {(ehIA || ehLead) && (
              <span className={`font-semibold ${ehIA ? "text-brand-violet" : "text-brand-blue"}`}>
                {ehIA ? "Lara" : "Lead"}:{" "}
              </span>
            )}
            {conteudo}
          </p>
        );
      })}
    </div>
  );
}

/*
 * A cola do Eric: o resumo pré-reunião gerado pela IA a partir da
 * ligação + conversa do WhatsApp. Nasce sozinho quando a Lara marca
 * pelo WhatsApp; o botão gera para as marcadas por telefone e
 * atualiza quando a conversa evoluiu depois.
 */
function ColaReuniao({ reuniao }) {
  const [texto, setTexto] = useState(reuniao.briefing || null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    try {
      const r = await fetch("/api/reunioes/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventoId: reuniao.id }),
      });
      const d = await r.json();
      if (!r.ok) setErro(d.erro || "Não deu para gerar agora.");
      else setTexto(d.briefing);
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-semibold text-brand-cyan">
          <NotebookPen size={12} /> Cola pra reunião
        </p>
        <button onClick={gerar} disabled={gerando} className="btn-fantasma px-2.5 py-1 text-xs">
          {gerando ? (
            <>
              <Loader2 size={11} className="animate-spin" /> preparando...
            </>
          ) : texto ? (
            "Atualizar"
          ) : (
            "Preparar reunião"
          )}
        </button>
      </div>
      {texto ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">{texto}</p>
      ) : (
        <p className="text-xs text-slate-500">
          {erro ||
            "Um resumo curto de tudo que o lead falou — na ligação e no WhatsApp — pra você ler 2 minutos antes de entrar na chamada."}
        </p>
      )}
      {erro && texto && <p className="mt-1 text-xs text-red-400">{erro}</p>}
    </div>
  );
}

function linkGoogle(r) {
  const ini = new Date(r.inicio);
  const fim = new Date(ini.getTime() + 3600000);
  const fmt = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: r.titulo,
    dates: `${fmt(ini)}/${fmt(fim)}`,
    details: "Reunião agendada pela SDR IA" + (r.telefone ? ` · ${r.telefone}` : ""),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export default function ReunioesLista({ reunioes = [] }) {
  const [aberta, setAberta] = useState(reunioes[0]?.id ?? null);
  const [filtro, setFiltro] = useState("Próximas");

  const agora = Date.now();
  const proximas = reunioes.filter((r) => new Date(r.inicio).getTime() >= agora);
  const passadas = reunioes.filter((r) => new Date(r.inicio).getTime() < agora);
  const lista = filtro === "Próximas" ? proximas : passadas;

  const fmtData = (iso) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  const fmtHora = (iso) =>
    new Date(iso).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtDuracao = (ms) => {
    const s = Math.round((ms || 0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <>
      <PageHeader
        titulo="Reuniões"
        subtitulo="Cada reunião com a conversa que a gerou — chegue sabendo o que foi falado."
      />

      <div className="mb-5 flex gap-2">
        {[
          ["Próximas", proximas.length],
          ["Realizadas", passadas.length],
        ].map(([nome, total]) => (
          <button
            key={nome}
            onClick={() => setFiltro(nome)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              filtro === nome
                ? "bg-gradient-to-r from-brand-blue to-brand-violet text-white"
                : "border border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {nome} ({total})
          </button>
        ))}
      </div>

      {lista.length === 0 && (
        <div className="card p-8 text-center">
          <CalendarCheck size={26} className="mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">
            {filtro === "Próximas"
              ? "Nenhuma reunião agendada ainda."
              : "Nenhuma reunião realizada ainda."}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Quando a Lara marcar na ligação, a reunião aparece aqui automaticamente.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {lista.map((r) => (
          <div
            key={r.id}
            className={`card overflow-hidden ${r.origem === "ia" ? "border-brand-violet/30" : ""}`}
          >
            <button
              onClick={() => setAberta(aberta === r.id ? null : r.id)}
              className="flex w-full items-center gap-4 p-4 text-left"
            >
              {/* Data em destaque */}
              <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-navy-900 py-2">
                <span className="font-display text-xl font-bold text-white">
                  {new Date(r.inicio).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                  })}
                </span>
                <span className="text-xs uppercase text-slate-500">
                  {new Date(r.inicio).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    month: "short",
                  })}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{r.titulo}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                  <span className="capitalize">{fmtData(r.inicio)}</span>
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <Clock size={11} /> {fmtHora(r.inicio)}
                  </span>
                  {r.telefone && <span>{formatarExibicao(r.telefone)}</span>}
                </p>
                {r.origem === "ia" && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-brand-violet">
                    <Sparkles size={11} /> Agendada pela Lara
                  </p>
                )}
              </div>

              <ChevronDown
                size={18}
                className={`shrink-0 text-slate-500 transition ${aberta === r.id ? "rotate-180" : ""}`}
              />
            </button>

            {aberta === r.id && (
              <div className="flex flex-col gap-3 border-t border-white/5 p-4">
                <ColaReuniao reuniao={r} />
                {r.ligacao ? (
                  <>
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone size={12} /> Ligação de{" "}
                      {new Date(r.ligacao.quando).toLocaleDateString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        day: "2-digit",
                        month: "2-digit",
                      })}{" "}
                      · durou {fmtDuracao(r.ligacao.duracaoMs)}
                    </p>

                    {r.ligacao.recordingUrl && <PlayerAudio url={r.ligacao.recordingUrl} />}

                    {r.ligacao.resumo && (
                      <div className="rounded-xl border border-brand-violet/30 bg-brand-violet/10 p-3">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-brand-violet">
                          <Sparkles size={12} /> O que foi conversado
                        </p>
                        <p className="text-sm leading-relaxed text-slate-200">{r.ligacao.resumo}</p>
                      </div>
                    )}

                    {r.ligacao.transcript && <Transcricao texto={r.ligacao.transcript} />}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    Não encontrei a ligação vinculada a esta reunião.
                  </p>
                )}

                <a
                  href={linkGoogle(r)}
                  target="_blank"
                  className="btn-fantasma self-start text-xs"
                >
                  <ExternalLink size={12} /> Adicionar ao Google Agenda
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
