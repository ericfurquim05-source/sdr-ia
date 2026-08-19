import { ArrowDownLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/Interface";
import PacotesRecarga from "@/components/PacotesRecarga";
import { clienteLogado } from "@/lib/auth";
import { saldoAtual, extrato } from "@/lib/saldo";

/*
 * CARTEIRA — DADOS 100% REAIS
 * Saldo = soma dos lançamentos do banco (mesma fonte da sidebar,
 * então os dois nunca divergem). Extrato = tabela lancamentos.
 */

export const dynamic = "force-dynamic";

const reais = (v) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataCurta = (d) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const rotuloTipo = {
  recarga: "Recarga",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  ajuste: "Ajuste",
};

export default async function Carteira() {
  const cliente = await clienteLogado();

  // Middleware já bloqueia sem login; isso é só um guarda extra.
  if (!cliente) return null;

  const precoMinuto = Number(cliente.preco_minuto ?? 1.5);
  const [saldo, lancamentos] = await Promise.all([
    saldoAtual(cliente.id),
    extrato(cliente.id, 30),
  ]);

  const minutos = Math.max(Math.floor(saldo / precoMinuto), 0);
  const consumoMes = lancamentos
    .filter((l) => l.valor < 0 && new Date(l.criado_em).getMonth() === new Date().getMonth())
    .reduce((soma, l) => soma + Math.abs(Number(l.valor)), 0);

  return (
    <>
      <PageHeader
        titulo="Carteira"
        subtitulo="Modelo pré-pago: você só paga pelos minutos que a IA fala."
      />

      {/* Saldo em destaque — mesma fonte da sidebar */}
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(32rem 16rem at 85% -20%, rgba(139,92,246,0.16), transparent), radial-gradient(28rem 14rem at 0% 120%, rgba(62,123,250,0.14), transparent)",
          }}
        />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Saldo atual
          </p>
          <p className="mt-2 bg-gradient-to-r from-white via-blue-200 to-violet-300 bg-clip-text font-display text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
            {reais(saldo)}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            ≈ {minutos} minutos de ligação · {reais(precoMinuto)}/minuto
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400">
            <Sparkles size={12} className="text-brand-violet" />
            Consumo do mês: {reais(consumoMes)}
          </p>
        </div>
      </section>

      {/* Pacotes de recarga */}
      <section className="mt-8">
        <h2 className="mb-4 font-display text-lg font-semibold text-white">Adicionar saldo</h2>
        <PacotesRecarga precoMinuto={precoMinuto} />
      </section>

      {/* Extrato real */}
      <section className="mt-8">
        <h2 className="mb-4 font-display text-lg font-semibold text-white">Extrato</h2>
        {lancamentos.length === 0 ? (
          <p className="card p-6 text-sm text-slate-400">
            Nenhuma movimentação ainda. As ligações e recargas vão aparecer aqui.
          </p>
        ) : (
          <div className="card divide-y divide-white/5">
            {lancamentos.map((l) => {
              const credito = Number(l.valor) > 0;
              return (
                <div key={l.id} className="flex items-center gap-3 p-4">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      credito ? "bg-emerald-500/10 text-emerald-400" : "bg-brand-blue/10 text-blue-300"
                    }`}
                  >
                    {credito ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {l.descricao || rotuloTipo[l.tipo] || l.tipo}
                    </p>
                    <p className="text-xs text-slate-500">
                      {rotuloTipo[l.tipo] || l.tipo} · {dataCurta(l.criado_em)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums ${credito ? "text-emerald-400" : "text-slate-300"}`}
                  >
                    {credito ? "+" : ""}
                    {reais(l.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
