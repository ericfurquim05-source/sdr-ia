"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Wand2, Save, Loader2, Check, Snowflake, Flame } from "lucide-react";
import { MODELOS, montarPrompt } from "@/lib/modelos-agente";

/*
 * Tela de agentes. O cliente escolhe o que a IA vai fazer,
 * preenche três campos e publica — sem nunca abrir a Retell.
 * O botão "Melhorar com IA" reescreve o roteiro aplicando o que
 * aprendemos nas ligações reais.
 */
export default function ConstrutorAgente({ clientes = [], agentes = [] }) {
  const router = useRouter();

  const [clienteId, setClienteId] = useState(clientes[0]?.id ?? null);
  const [tipo, setTipo] = useState("fria");

  const clienteAtual = clientes.find((c) => c.id === clienteId);
  const existente = agentes.find((a) => a.cliente_id === clienteId && a.tipo === tipo);
  const [modelo, setModelo] = useState("prospeccao");
  const [assistente, setAssistente] = useState("Ana");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [oferta, setOferta] = useState("");
  const [prompt, setPrompt] = useState("");

  // Ao trocar de cliente, carrega o roteiro que já existe para ele
  const trocarCliente = (id) => {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    setNomeEmpresa(c?.empresa || c?.nome || "");
    const a = agentes.find((x) => x.cliente_id === id && x.tipo === tipo);
    setPrompt(a?.prompt || "");
    setAviso(null);
  };
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);

  const gerarDoModelo = () => {
    setPrompt(montarPrompt(modelo, { assistente, empresa: nomeEmpresa, oferta }));
    setAviso({
      erro: false,
      texto: "Roteiro gerado. Leia, ajuste o que quiser e publique.",
    });
  };

  const melhorar = async () => {
    setOcupado("melhorar");
    setAviso(null);
    try {
      const r = await fetch("/api/agentes/melhorar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, contexto: `${nomeEmpresa}. ${oferta}` }),
      });
      const d = await r.json();
      if (!r.ok) return setAviso({ erro: true, texto: d.erro });
      setPrompt(d.prompt);
      setAviso({ erro: false, texto: "Roteiro reescrito. Confira antes de publicar." });
    } catch {
      setAviso({ erro: true, texto: "Falha de conexão." });
    } finally {
      setOcupado(null);
    }
  };

  const publicar = async () => {
    setOcupado("publicar");
    setAviso(null);
    try {
      const r = await fetch("/api/agentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          tipo,
          nome: `${assistente} — ${nomeEmpresa || "cliente"}`,
          prompt,
        }),
      });
      const d = await r.json();
      setAviso({ erro: !r.ok, texto: d.mensagem || d.erro });
      if (r.ok) router.refresh();
    } catch {
      setAviso({ erro: true, texto: "Falha de conexão." });
    } finally {
      setOcupado(null);
    }
  };

  const modeloAtual = MODELOS.find((m) => m.id === modelo);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo-pagina">Montar agente</h1>
          <p className="mt-1 text-sm text-slate-500">
            Você monta o roteiro e entrega pronto. O cliente só sobe a lista e dispara.
          </p>
        </div>
        {existente && (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
            <Check size={12} /> Este cliente já tem agente {tipo}
          </span>
        )}
      </div>

      {/* Cliente alvo */}
      <section className="card mb-4 p-5">
        <p className="mb-3 text-sm font-semibold text-white">Para qual cliente?</p>
        {clientes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <select
            value={clienteId ?? ""}
            onChange={(e) => trocarCliente(Number(e.target.value))}
            className="campo text-sm"
          >
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.empresa || c.nome} — {c.email}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* 1. O que a IA vai fazer */}
      <section className="card mb-4 p-5">
        <p className="mb-1 text-sm font-semibold text-white">1. O que a IA vai fazer?</p>
        <p className="mb-4 text-xs text-slate-500">
          Escolha um modelo pronto — depois você ajusta o texto do jeito que quiser.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODELOS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModelo(m.id)}
              className={`rounded-xl border p-4 text-left transition ${
                modelo === m.id
                  ? "border-brand-blue bg-brand-blue/10"
                  : "border-white/10 hover:border-white/20"
              }`}
            >
              <p className="text-sm font-semibold text-white">{m.nome}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.descricao}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Dados da empresa */}
      <section className="card mb-4 p-5">
        <p className="mb-4 text-sm font-semibold text-white">2. Sobre você</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Nome da assistente</span>
            <input
              value={assistente}
              onChange={(e) => setAssistente(e.target.value)}
              placeholder="Ana"
              className="campo text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Nome da empresa</span>
            <input
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              placeholder="Minha Empresa"
              className="campo text-sm"
            />
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs text-slate-500">
            O que vocês oferecem? Escreva como se estivesse explicando para um amigo.
          </span>
          <textarea
            value={oferta}
            onChange={(e) => setOferta(e.target.value)}
            rows={3}
            placeholder="Ex: a gente faz manutenção de ar-condicionado para empresas, com contrato mensal e atendimento em até 24 horas."
            className="campo text-sm"
          />
        </label>

        <button onClick={gerarDoModelo} className="btn-fantasma mt-4 text-sm">
          <Bot size={14} /> Gerar roteiro com {modeloAtual?.nome.toLowerCase()}
        </button>
      </section>

      {/* 3. Roteiro */}
      <section className="card mb-4 p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-white">3. Roteiro da ligação</p>
          <button
            onClick={melhorar}
            disabled={ocupado !== null || prompt.length < 30}
            className="ml-auto flex items-center gap-1.5 rounded-xl border border-brand-violet/40 px-3 py-1.5 text-xs font-semibold text-brand-violet transition hover:bg-brand-violet/10 disabled:opacity-40"
          >
            {ocupado === "melhorar" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Wand2 size={13} />
            )}
            Melhorar com IA
          </button>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={16}
          placeholder="Escolha um modelo acima para gerar, ou escreva do seu jeito e clique em Melhorar com IA."
          className="campo font-mono text-xs leading-relaxed"
        />

        <p className="mt-2 text-xs text-slate-600">
          {prompt.length} caracteres · o &quot;Melhorar com IA&quot; reescreve aplicando o
          que funciona em ligação de verdade: abertura natural, pergunta aberta e nada de
          catálogo recitado.
        </p>
      </section>

      {/* 4. Tipo e publicação */}
      <section className="card p-5">
        <p className="mb-4 text-sm font-semibold text-white">4. Publicar</p>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {[
            { id: "fria", rotulo: "Lista fria", desc: "Quem ainda não conhece você", icone: Snowflake },
            { id: "quente", rotulo: "Lista quente", desc: "Quem já teve contato", icone: Flame },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTipo(t.id)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                tipo === t.id ? "border-brand-blue bg-brand-blue/10" : "border-white/10"
              }`}
            >
              <t.icone size={18} className={tipo === t.id ? "text-brand-blue" : "text-slate-500"} />
              <div>
                <p className="text-sm font-semibold text-white">{t.rotulo}</p>
                <p className="text-xs text-slate-500">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {aviso && (
          <p
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
              aviso.erro
                ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {aviso.texto}
          </p>
        )}

        <button
          onClick={publicar}
          disabled={ocupado !== null || prompt.length < 50}
          className="btn-primario w-full !py-3"
        >
          {ocupado === "publicar" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {existente ? "Salvar alterações" : "Publicar agente"}
        </button>

        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          Publicado, o agente entra nas campanhas de{" "}
          <b className="text-slate-400">{clienteAtual?.empresa || clienteAtual?.nome || "—"}</b>{" "}
          automaticamente. Ele não precisa configurar nada.
        </p>
      </section>
    </>
  );
}
