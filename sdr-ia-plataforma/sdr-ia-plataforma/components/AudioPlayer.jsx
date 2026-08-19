"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2 } from "lucide-react";

/*
 * Mini player das gravações da Retell.
 * - Quando `src` (recording_url do webhook) existir, toca o áudio real.
 * - Sem `src`, roda em modo demonstração (progresso simulado),
 *   para a interface ser avaliada antes da integração.
 */
export default function AudioPlayer({ src, duracaoSegundos = 0 }) {
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0); // segundos

  const total = duracaoSegundos || 1;

  useEffect(() => {
    return () => clearInterval(timerRef.current); // limpeza ao desmontar
  }, []);

  const formatar = (s) => {
    const m = Math.floor(s / 60);
    const seg = Math.floor(s % 60);
    return `${m}:${String(seg).padStart(2, "0")}`;
  };

  const alternar = () => {
    if (src && audioRef.current) {
      // Áudio real vindo do webhook da Retell
      if (tocando) audioRef.current.pause();
      else audioRef.current.play();
      setTocando(!tocando);
      return;
    }
    // Modo demonstração — progresso simulado
    if (tocando) {
      clearInterval(timerRef.current);
      setTocando(false);
    } else {
      setTocando(true);
      timerRef.current = setInterval(() => {
        setPosicao((p) => {
          if (p + 0.1 >= total) {
            clearInterval(timerRef.current);
            setTocando(false);
            return 0;
          }
          return p + 0.1;
        });
      }, 100);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-navy-900 px-3 py-2.5">
      {src && (
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={(e) => setPosicao(e.currentTarget.currentTime)}
          onEnded={() => {
            setTocando(false);
            setPosicao(0);
          }}
        />
      )}

      <button
        onClick={alternar}
        aria-label={tocando ? "Pausar gravação" : "Ouvir gravação"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-brand-blue to-brand-violet text-white transition hover:opacity-90"
      >
        {tocando ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-violet transition-[width] duration-100"
            style={{ width: `${Math.min((posicao / total) * 100, 100)}%` }}
          />
        </div>
      </div>

      <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-slate-500">
        <Volume2 size={13} />
        {formatar(posicao)} / {formatar(total)}
      </span>
    </div>
  );
}
