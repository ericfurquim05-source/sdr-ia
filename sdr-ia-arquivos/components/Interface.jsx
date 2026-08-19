import { ArrowUpRight, ArrowDownRight, Sparkles } from "lucide-react";

/* Cabeçalho padrão das páginas */
export function PageHeader({ titulo, subtitulo, children }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="titulo-pagina">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}

/* Card de indicador (KPI) do dashboard */
export function KpiCard({ rotulo, valor, delta, positivo = true, icone: Icone, corIcone = "text-brand-blue" }) {
  const Seta = positivo ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{rotulo}</p>
        {Icone && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
            <Icone size={17} className={corIcone} />
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">{valor}</p>
      {delta && (
        <p className={`mt-1.5 flex items-center gap-1 text-xs ${positivo ? "text-emerald-400" : "text-rose-400"}`}>
          <Seta size={13} /> {delta} <span className="text-slate-500">vs. ontem</span>
        </p>
      )}
    </div>
  );
}

/* Badge de status das chamadas — violeta marca o que a IA conquistou */
const estilosStatus = {
  "Reunião agendada": "bg-brand-violet/15 text-violet-300 ring-brand-violet/40",
  Atendida: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  "Não atendida": "bg-slate-500/10 text-slate-400 ring-slate-500/30",
};

export function StatusBadge({ status }) {
  const estilo = estilosStatus[status] || estilosStatus["Não atendida"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${estilo}`}>
      {status === "Reunião agendada" && <Sparkles size={12} />}
      {status}
    </span>
  );
}
