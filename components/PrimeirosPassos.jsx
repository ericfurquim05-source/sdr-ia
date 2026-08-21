"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, X, Rocket } from "lucide-react";

/*
 * ONBOARDING — primeiros passos.
 * Aparece enquanto o cliente não completou o ciclo básico e some
 * sozinho quando ele termina. Cada passo mostra se já foi feito,
 * então ele sempre sabe onde parou.
 */
export default function PrimeirosPassos({ progresso }) {
  const [fechado, setFechado] = useState(false);

  const passos = [
    {
      id: "saldo",
      titulo: "Adicione saldo",
      descricao: "O modelo é pré-pago: você só paga pelos minutos falados.",
      feito: progresso.temSaldo,
      href: "/carteira",
      acao: "Ir para a Carteira",
    },
    {
      id: "lista",
      titulo: "Suba sua lista de contatos",
      descricao: "Uma planilha com nome e telefone. O site organiza o resto.",
      feito: progresso.temContatos,
      href: "/campanhas",
      acao: "Subir planilha",
    },
    {
      id: "ligacao",
      titulo: "Dispare a primeira campanha",
      descricao: "A IA liga, conversa e registra tudo — você acompanha em tempo real.",
      feito: progresso.temLigacoes,
      href: "/campanhas",
      acao: "Executar campanha",
    },
    {
      id: "reuniao",
      titulo: "Receba a primeira reunião",
      descricao: "Quando a IA agendar, ela aparece aqui com a gravação da conversa.",
      feito: progresso.temReunioes,
      href: "/reunioes",
      acao: "Ver reuniões",
    },
  ];

  const concluidos = passos.filter((p) => p.feito).length;
  const proximo = passos.find((p) => !p.feito);

  // Terminou tudo ou fechou na mão: não mostra mais
  if (fechado || !proximo) return null;

  return (
    <div className="card mb-6 overflow-hidden border-brand-blue/25">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-violet">
          <Rocket size={15} className="text-white" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Primeiros passos</p>
          <p className="text-xs text-slate-500">
            {concluidos} de {passos.length} concluídos
          </p>
        </div>

        {/* Barra de progresso */}
        <div className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-navy-800 sm:block">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-blue to-brand-violet transition-all"
            style={{ width: `${(concluidos / passos.length) * 100}%` }}
          />
        </div>

        <button
          onClick={() => setFechado(true)}
          className="text-slate-600 transition hover:text-slate-300"
          title="Ocultar"
        >
          <X size={16} />
        </button>
      </div>

      <div className="divide-y divide-white/5">
        {passos.map((p, i) => {
          const atual = p.id === proximo.id;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${atual ? "bg-brand-blue/5" : ""}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  p.feito
                    ? "bg-emerald-500/20 text-emerald-300"
                    : atual
                      ? "bg-gradient-to-br from-brand-blue to-brand-violet text-white"
                      : "border border-white/10 text-slate-600"
                }`}
              >
                {p.feito ? <Check size={12} /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    p.feito ? "text-slate-500 line-through" : "text-white"
                  }`}
                >
                  {p.titulo}
                </p>
                {!p.feito && (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{p.descricao}</p>
                )}
              </div>

              {atual && (
                <Link href={p.href} className="btn-primario shrink-0 !py-2 text-xs">
                  {p.acao} <ChevronRight size={13} />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
