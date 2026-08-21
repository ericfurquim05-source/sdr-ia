"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

/*
 * PLAYER DE GRAVAÇÃO
 * Corrige três problemas do player antigo:
 *  1. O áudio continuava tocando ao fechar o card ou atualizar a tela.
 *  2. Pausar não funcionava, porque a tela recriava o objeto de áudio.
 *  3. Dois players podiam tocar ao mesmo tempo.
 *
 * Aqui o áudio vive numa referência (não é recriado a cada render),
 * é encerrado quando o componente sai da tela, e ao dar play todos
 * os outros players param.
 */

// Player em execução no momento — só um toca por vez
let tocandoAgora = null;

export default function PlayerAudio({ url, compacto = false }) {
  const audioRef = useRef(null);
  const [tocando, setTocando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [duracao, setDuracao] = useState(0);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    const aoTocar = () => setProgresso(audio.currentTime);
    const aoCarregar = () => setDuracao(audio.duration || 0);
    const aoTerminar = () => {
      setTocando(false);
      setProgresso(0);
      if (tocandoAgora === audio) tocandoAgora = null;
    };

    audio.addEventListener("timeupdate", aoTocar);
    audio.addEventListener("loadedmetadata", aoCarregar);
    audio.addEventListener("ended", aoTerminar);
    audio.addEventListener("pause", () => setTocando(false));
    audio.addEventListener("play", () => setTocando(true));

    // Ao sair da tela: para o áudio e limpa tudo
    return () => {
      audio.pause();
      audio.src = "";
      audio.removeEventListener("timeupdate", aoTocar);
      audio.removeEventListener("loadedmetadata", aoCarregar);
      audio.removeEventListener("ended", aoTerminar);
      if (tocandoAgora === audio) tocandoAgora = null;
      audioRef.current = null;
    };
  }, [url]);

  const alternar = (e) => {
    e?.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      // Para qualquer outro player antes de começar este
      if (tocandoAgora && tocandoAgora !== audio) tocandoAgora.pause();
      tocandoAgora = audio;
      audio.play().catch(() => setTocando(false));
    } else {
      audio.pause();
      if (tocandoAgora === audio) tocandoAgora = null;
    }
  };

  const irPara = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duracao) return;
    const caixa = e.currentTarget.getBoundingClientRect();
    const posicao = (e.clientX - caixa.left) / caixa.width;
    audio.currentTime = Math.max(0, Math.min(duracao, posicao * duracao));
  };

  const fmt = (s) => {
    const t = Math.floor(s || 0);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  };

  // Versão pequena: só o botão redondo
  if (compacto) {
    return (
      <button
        onClick={alternar}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-blue/30 bg-brand-blue/10 text-brand-blue transition hover:border-brand-blue hover:bg-brand-blue/20"
        title={tocando ? "Pausar" : "Ouvir a ligação"}
      >
        {tocando ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-navy-900 px-3 py-2.5">
      <button
        onClick={alternar}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-violet text-white transition hover:opacity-90"
        title={tocando ? "Pausar" : "Ouvir"}
      >
        {tocando ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>

      {/* Barra clicável para avançar */}
      <div
        onClick={irPara}
        className="h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-navy-800"
        title="Clique para avançar"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-violet"
          style={{ width: duracao ? `${(progresso / duracao) * 100}%` : "0%" }}
        />
      </div>

      <span className="shrink-0 text-xs tabular-nums text-slate-500">
        {fmt(progresso)} / {fmt(duracao)}
      </span>
    </div>
  );
}
