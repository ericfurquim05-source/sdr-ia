"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rocket,
  Bot,
  CalendarDays,
  MessageCircle,
  Wallet,
  Sparkles,
  Plus,
  LogOut,
  CalendarCheck,
} from "lucide-react";

const itens = [
  { rotulo: "Dashboard", href: "/", icone: LayoutDashboard },
  { rotulo: "Campanhas", href: "/campanhas", icone: Rocket },
  { rotulo: "SDR IA", href: "/sdr-ia", icone: Bot },
  { rotulo: "Calendário", href: "/calendario", icone: CalendarDays },
  { rotulo: "WhatsApp", href: "/whatsapp", icone: MessageCircle },
  { rotulo: "Reuniões", href: "/reunioes", icone: CalendarCheck },
  { rotulo: "Carteira", href: "/carteira", icone: Wallet },
];

export default function Sidebar({ cliente, saldo = 0 }) {
  const pathname = usePathname();
  const precoMinuto = Number(cliente?.preco_minuto ?? 1.5);
  const minutos = Math.max(Math.floor(saldo / precoMinuto), 0);

  const sair = async () => {
    await fetch("/api/auth/sair", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-white/5 bg-navy-900/90 backdrop-blur-xl lg:w-64">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-4 py-6 lg:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-violet shadow-glow">
          <Sparkles size={18} className="text-white" />
        </span>
        <span className="hidden lg:block">
          <span className="block font-display text-lg font-semibold leading-none tracking-tight text-white">
            SDR&nbsp;IA
          </span>
          <span className="mt-1 block text-[11px] uppercase tracking-widest text-slate-500">
            Prospecção por voz
          </span>
        </span>
      </Link>

      {/* Navegação */}
      <nav className="flex-1 space-y-1 px-2 lg:px-3">
        {itens.map(({ rotulo, href, icone: Icone }) => {
          const ativo = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={rotulo}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                ativo
                  ? "bg-gradient-to-r from-brand-blue/20 to-brand-violet/10 text-white ring-1 ring-inset ring-brand-blue/40"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <Icone
                size={18}
                className={ativo ? "text-brand-blue" : "text-slate-500 group-hover:text-slate-300"}
              />
              <span className="hidden lg:inline">{rotulo}</span>
            </Link>
          );
        })}
      </nav>

      {/* Cliente logado */}
      {cliente && (
        <div className="hidden border-t border-white/5 px-4 py-3 lg:block">
          <p className="truncate text-sm font-medium text-slate-200">
            {cliente.empresa || cliente.nome}
          </p>
          <button
            onClick={sair}
            className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-slate-300"
          >
            <LogOut size={12} /> Sair da conta
          </button>
        </div>
      )}

      {/* Saldo pré-pago sempre à vista */}
      <div className="p-3 lg:p-4">
        <div className="hidden rounded-2xl border border-white/5 bg-navy-850 p-4 lg:block">
          <p className="text-[11px] uppercase tracking-widest text-slate-500">Saldo disponível</p>
          <p className="mt-1 font-display text-xl font-semibold text-white">
            R$ {Number(saldo).toFixed(2).replace(".", ",")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">≈ {minutos} minutos de ligação</p>
          <Link href="/carteira" className="btn-primario mt-3 w-full text-xs">
            <Plus size={14} /> Adicionar saldo
          </Link>
        </div>
        <Link
          href="/carteira"
          title="Adicionar saldo"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-brand-blue to-brand-violet text-white lg:hidden"
        >
          <Plus size={16} />
        </Link>
      </div>
    </aside>
  );
}
