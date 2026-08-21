"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/*
 * Captura erros de tela e mostra a mensagem real.
 * Sem isso o Next exibe apenas "Application error", que não
 * ajuda a descobrir a causa.
 */
export default function Erro({ error, reset }) {
  useEffect(() => {
    console.error("Erro na tela:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15">
        <AlertTriangle size={22} className="text-rose-400" />
      </span>

      <div>
        <h2 className="font-display text-xl font-semibold text-white">
          Algo quebrou nesta tela
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          A mensagem abaixo diz exatamente o que aconteceu.
        </p>
      </div>

      <pre className="max-w-xl overflow-x-auto rounded-xl border border-rose-500/20 bg-navy-900 p-4 text-left text-xs leading-relaxed text-rose-300">
        {error?.message || "Erro sem mensagem"}
        {error?.digest && `\n\ndigest: ${error.digest}`}
      </pre>

      <div className="flex gap-2">
        <button onClick={() => reset()} className="btn-primario text-sm">
          <RotateCw size={14} /> Tentar de novo
        </button>
        <a href="/" className="btn-fantasma text-sm">
          Voltar ao início
        </a>
      </div>
    </div>
  );
}
