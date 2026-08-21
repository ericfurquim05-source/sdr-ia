"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, KeyRound, Wallet, Power, Copy, Check, Loader2, Search,
} from "lucide-react";
import { PageHeader } from "@/components/Interface";

/*
 * Painel de suporte. Resolve o dia a dia sem precisar de deploy:
 * gerar link de senha, creditar saldo, ativar/desativar conta e
 * ajustar o preço por minuto de cada cliente.
 */
export default function AdminPainel({ clientes = [] }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const brl = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const lista = clientes.filter((c) =>
    `${c.nome} ${c.empresa} ${c.email}`.toLowerCase().includes(busca.toLowerCase())
  );

  const agir = async (acao, clienteId, valor = null) => {
    setOcupado(`${acao}-${clienteId}`);
    setAviso(null);
    setCopiado(false);
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, clienteId, valor }),
      });
      const d = await r.json();
      setAviso({
        erro: !r.ok,
        texto: d.mensagem || d.erro,
        link: d.link || null,
        senha: d.senha || null,
      });
      if (r.ok) router.refresh();
    } catch {
      setAviso({ erro: true, texto: "Falha de conexão." });
    } finally {
      setOcupado(null);
    }
  };

  const creditar = (id) => {
    const valor = window.prompt("Quanto creditar para este cliente? (ex: 500)");
    if (valor) agir("creditar", id, Number(valor.replace(",", ".")));
  };

  const ajustarPreco = (id, atual) => {
    const valor = window.prompt("Novo preço por minuto (ex: 1.50)", String(atual));
    if (valor) agir("preco_minuto", id, Number(valor.replace(",", ".")));
  };

  return (
    <>
      <PageHeader
        titulo="Administração"
        subtitulo="Suporte aos clientes: senha, saldo, preço e status da conta."
      >
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400">
          <Users size={12} /> {clientes.length} clientes
        </span>
      </PageHeader>

      <div className="campo mb-5 flex items-center gap-2 !py-2.5">
        <Search size={15} className="text-slate-500" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, empresa ou e-mail..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
        />
      </div>

      {aviso && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            aviso.erro
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          }`}
        >
          <p>{aviso.texto}</p>

          {aviso.link && (
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg bg-navy-900 px-2 py-1.5 text-xs text-slate-300">
                {aviso.link}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aviso.link);
                  setCopiado(true);
                }}
                className="btn-fantasma !py-1.5 text-xs"
              >
                {copiado ? <Check size={12} /> : <Copy size={12} />}
                {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
          )}

          {aviso.senha && (
            <p className="mt-2">
              Senha temporária: <b className="font-mono text-white">{aviso.senha}</b>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {lista.length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-500">
            Nenhum cliente encontrado.
          </div>
        )}

        {lista.map((c) => (
          <div key={c.id} className={`card p-5 ${!c.ativo ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">
                  {c.empresa || c.nome}
                  {!c.ativo && (
                    <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300">
                      desativada
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {c.nome} · {c.email}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    Saldo <b className="text-emerald-300">{brl(c.saldo)}</b>
                  </span>
                  <span>
                    Preço <b className="text-slate-300">{brl(c.preco_minuto)}/min</b>
                  </span>
                  <span>
                    <b className="text-slate-300">{c.ligacoes}</b> ligações
                  </span>
                  <span>
                    <b className="text-slate-300">{c.na_fila}</b> na fila
                  </span>
                  <span>
                    <b className="text-brand-violet">{c.reunioes}</b> reuniões
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => agir("link_senha", c.id)}
                  disabled={ocupado !== null}
                  className="btn-fantasma text-xs"
                >
                  {ocupado === `link_senha-${c.id}` ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <KeyRound size={12} />
                  )}
                  Link de senha
                </button>

                <button
                  onClick={() => creditar(c.id)}
                  disabled={ocupado !== null}
                  className="btn-fantasma text-xs"
                >
                  <Wallet size={12} /> Creditar
                </button>

                <button
                  onClick={() => ajustarPreco(c.id, c.preco_minuto)}
                  disabled={ocupado !== null}
                  className="btn-fantasma text-xs"
                >
                  Preço
                </button>

                <button
                  onClick={() => agir("alternar_ativo", c.id)}
                  disabled={ocupado !== null}
                  className={`btn-fantasma text-xs ${c.ativo ? "" : "!text-emerald-300"}`}
                >
                  <Power size={12} /> {c.ativo ? "Desativar" : "Reativar"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-slate-600">
        &quot;Link de senha&quot; gera um endereço válido por 24 horas para o cliente criar
        a própria senha — envie por WhatsApp. Todo crédito manual fica registrado no
        extrato com o seu e-mail.
      </p>
    </>
  );
}
