/*
 * O console de administração fica FORA da navegação do cliente:
 * sem sidebar, sem saldo, sem abas. É a área do dono da operação,
 * não do usuário do produto.
 */
export const metadata = { title: "Console — SDR IA" };

export default function LayoutAdmin({ children }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/5 bg-navy-900">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-violet">
            <svg width="16" height="16" viewBox="0 0 56 56" aria-hidden="true">
              <g stroke="#fff" strokeWidth="3.5" strokeLinecap="round">
                <line x1="15" y1="28" x2="15" y2="28" />
                <line x1="22" y1="21" x2="22" y2="35" />
                <line x1="29" y1="14" x2="29" y2="42" />
                <line x1="36" y1="19" x2="36" y2="37" />
                <line x1="43" y1="25" x2="43" y2="31" />
              </g>
            </svg>
          </span>
          <div>
            <p className="font-display text-sm font-bold text-white">Console</p>
            <p className="text-xs text-slate-500">Gestão de clientes</p>
          </div>
          <nav className="ml-auto flex items-center gap-1">
            <a
              href="/admin"
              className="rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              Clientes
            </a>
            <a
              href="/admin/agentes"
              className="rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              Montar agente
            </a>
            <a
              href="/"
              className="ml-2 border-l border-white/10 pl-3 text-xs text-slate-600 transition hover:text-white"
            >
              ← Painel
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
