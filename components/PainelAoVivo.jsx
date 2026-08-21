"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Radio, PhoneCall } from "lucide-react";

/*
 * PAINEL AO VIVO — o bloco mais importante para a demonstração.
 * Mostra as ligações acontecendo neste instante e as últimas
 * encerradas, com play imediato. Atualiza sozinho a cada 15s,
 * então os números sobem na frente do cliente.
 */

function MiniPlayer({ url }) {
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio(url) : null));
  const [tocando, setTocando] = useState(false);

  useEffect(() => () => audio?.pause(), [audio]);

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
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-blue/30 bg-brand-blue/10 text-brand-blue transition hover:border-brand-blue hover:bg-brand-blue/20"
      title="Ouvir a ligação"
    >
      {tocando ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
    </button>
  );
}

export default function PainelAoVivo({ inicial }) {
  const [dados, setDados] = useState(inicial);

  // Atualiza sozinho: os números sobem enquanto o cliente olha
  useEffect(() => {
    const buscar = async () => {
      try {
        const r = await fetch("/api/ao-vivo");
        if (r.ok) setDados(await r.json());
      } catch {
        /* silencioso: se falhar, mantém o que já está na tela */
      }
    };
    const timer = setInterval(buscar, 15000);
    return () => clearInterval(timer);
  }, []);

  const { emLigacao = 0, ultimas = [] } = dados ?? {};

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
  const fmtTel = (t) =>
    String(t).length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t;

  return (
    <div className="card mb-6 overflow-hidden">
      {/* Cabeçalho ao vivo */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className="relative flex h-2.5 w-2.5">
          {emLigacao > 0 && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
              emLigacao > 0 ? "bg-emerald-400" : "bg-slate-600"
            }`}
          />
        </span>

        <p className="text-sm font-semibold text-white">
          {emLigacao > 0 ? (
            <>
              {emLigacao} {emLigacao === 1 ? "ligação acontecendo" : "ligações acontecendo"} agora
            </>
          ) : (
            "Nenhuma ligação em curso"
          )}
        </p>

        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
          <Radio size={12} /> ao vivo
        </span>
      </div>

      {/* Últimas ligações com play imediato */}
      <div className="divide-y divide-white/5">
        {ultimas.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <PhoneCall size={22} className="text-slate-600" />
            <p className="text-sm text-slate-400">As ligações aparecem aqui em tempo real</p>
            <p className="text-xs text-slate-600">
              Suba uma lista em Campanhas e acompanhe a operação por aqui.
            </p>
          </div>
        )}

        {ultimas.map((l) => (
          <div key={l.id} className="flex items-center gap-3.5 px-5 py-3.5">
            {l.recording_url ? (
              <MiniPlayer url={l.recording_url} />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-600">
                <PhoneCall size={13} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {l.nome || fmtTel(l.telefone)}
                {l.nome && <span className="text-slate-500"> · {fmtTel(l.telefone)}</span>}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {fmtHora(l.criado_em)} · <b className="font-semibold text-slate-400">{fmtDuracao(l.duracao_ms)}</b>
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                l.sucesso
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-navy-800 text-slate-500"
              }`}
            >
              {l.sucesso ? "atendida" : "sem contato"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
