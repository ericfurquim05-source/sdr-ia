"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown } from "lucide-react";

/*
 * FILTRO DE PERÍODO — estilo Google Ads.
 * Presets prontos (Hoje, Ontem, 7 dias, Este mês...) + intervalo
 * personalizado. Ao aplicar, recarrega o Dashboard com ?de=&ate=,
 * e o servidor recalcula tudo para o período.
 */

const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function calcularPresets() {
  const hoje = new Date();
  const d = (n) => {
    const x = new Date(hoje);
    x.setDate(x.getDate() + n);
    return x;
  };
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioMesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fimMesPassado = new Date(hoje.getFullYear(), hoje.getMonth(), 0);

  return [
    { rotulo: "Hoje", de: fmt(hoje), ate: fmt(hoje) },
    { rotulo: "Ontem", de: fmt(d(-1)), ate: fmt(d(-1)) },
    { rotulo: "Últimos 7 dias", de: fmt(d(-6)), ate: fmt(hoje) },
    { rotulo: "Últimos 14 dias", de: fmt(d(-13)), ate: fmt(hoje) },
    { rotulo: "Este mês", de: fmt(inicioMes), ate: fmt(hoje) },
    { rotulo: "Últimos 30 dias", de: fmt(d(-29)), ate: fmt(hoje) },
    { rotulo: "Mês passado", de: fmt(inicioMesPassado), ate: fmt(fimMesPassado) },
    { rotulo: "Todo o período", de: "2024-01-01", ate: fmt(hoje) },
  ];
}

export default function FiltroPeriodo({ de, ate, base = "/", extra = "" }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [deCustom, setDeCustom] = useState(de);
  const [ateCustom, setAteCustom] = useState(ate);

  const presets = useMemo(calcularPresets, []);
  const ativo = presets.find((p) => p.de === de && p.ate === ate);
  const rotuloBotao = ativo
    ? ativo.rotulo
    : `${de.split("-").reverse().join("/")} — ${ate.split("-").reverse().join("/")}`;

  const aplicar = (novoDe, novoAte) => {
    setAberto(false);
    // "extra" preserva outros parâmetros da página (ex.: ordenação)
    router.push(`${base}?de=${novoDe}&ate=${novoAte}${extra}`);
  };

  return (
    <div className="relative">
      <button onClick={() => setAberto(!aberto)} className="btn-fantasma text-sm">
        <Calendar size={14} />
        {rotuloBotao}
        <ChevronDown size={14} className={`transition ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <>
          {/* clique fora fecha */}
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="card absolute right-0 z-20 mt-2 w-72 p-3">
            <div className="flex flex-col">
              {presets.map((p) => (
                <button
                  key={p.rotulo}
                  onClick={() => aplicar(p.de, p.ate)}
                  className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                    ativo?.rotulo === p.rotulo
                      ? "bg-gradient-to-r from-brand-blue/25 to-brand-violet/25 text-white"
                      : "text-slate-300 hover:bg-navy-800"
                  }`}
                >
                  {p.rotulo}
                </button>
              ))}
            </div>

            <div className="mt-3 border-t border-white/5 pt-3">
              <p className="mb-2 text-xs font-semibold text-slate-400">Personalizar</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={deCustom}
                  onChange={(e) => setDeCustom(e.target.value)}
                  className="campo !px-2 !py-1.5 text-xs"
                />
                <span className="text-slate-600">—</span>
                <input
                  type="date"
                  value={ateCustom}
                  onChange={(e) => setAteCustom(e.target.value)}
                  className="campo !px-2 !py-1.5 text-xs"
                />
              </div>
              <button
                onClick={() => deCustom && ateCustom && aplicar(deCustom, ateCustom)}
                className="btn-primario mt-3 w-full !py-2 text-xs"
              >
                Aplicar período
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
