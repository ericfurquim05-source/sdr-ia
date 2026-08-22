"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send, ArrowLeft, MessageCircle, Sparkles, CheckCircle2, ExternalLink, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/Interface";

/*
 * WhatsApp — dois estados, sem dados de demonstração:
 *  · NÃO conectado → guia de conexão com a Meta (passo a passo real)
 *  · Conectado     → conversas reais + envio pela Cloud API
 */

function GuiaConexao() {
  const variaveis = [
    ["WHATSAPP_TOKEN", "token permanente do app (Meta for Developers)"],
    ["WHATSAPP_PHONE_NUMBER_ID", "ID do número (não é o telefone em si)"],
    ["WHATSAPP_TEMPLATE", "nome do template aprovado (ex.: followup_ligacao)"],
    ["WHATSAPP_VERIFY_TOKEN", "senha que você inventa para validar o webhook"],
  ];

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
          <MessageCircle size={18} className="text-emerald-400" />
        </span>
        <div>
          <p className="font-semibold text-white">Conectar seu número do WhatsApp</p>
          <p className="text-sm text-slate-500">
            API oficial da Meta (Facebook Business) — feito uma única vez, em ~15 minutos.
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-3 text-sm text-slate-300">
        <li>
          <b className="text-white">1.</b> Acesse{" "}
          <a
            href="https://developers.facebook.com"
            target="_blank"
            className="inline-flex items-center gap-1 text-brand-blue hover:underline"
          >
            developers.facebook.com <ExternalLink size={12} />
          </a>{" "}
          → <b>Create App</b> → tipo <b>Business</b> → adicione o produto <b>WhatsApp</b>.
        </li>
        <li>
          <b className="text-white">2.</b> Em <b>API Setup</b>, copie o <b>token permanente</b> e o{" "}
          <b>Phone Number ID</b> do número que vai usar.
        </li>
        <li>
          <b className="text-white">3.</b> Crie um <b>template</b> de mensagem (ex.:{" "}
          <code className="rounded bg-navy-900 px-1.5 py-0.5 text-xs">followup_ligacao</code> —
          &quot;Oi {"{{1}}"}, tentamos te ligar há pouco...&quot;) e aguarde a aprovação da Meta.
        </li>
        <li>
          <b className="text-white">4.</b> Na Vercel → Settings → Environment Variables, preencha:
          <div className="mt-2 flex flex-col gap-1.5">
            {variaveis.map(([nome, desc]) => (
              <div key={nome} className="rounded-lg border border-white/5 bg-navy-900 px-3 py-2">
                <code className="text-xs text-brand-blue">{nome}</code>
                <span className="ml-2 text-xs text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </li>
        <li>
          <b className="text-white">5.</b> No app da Meta → <b>Configuration</b>, cadastre o webhook:{" "}
          <code className="rounded bg-navy-900 px-1.5 py-0.5 text-xs">
            https://sdr-ia-six.vercel.app/api/whatsapp/webhook
          </code>{" "}
          com o mesmo verify token, e assine o campo <b>messages</b>. Depois, Redeploy na Vercel.
        </li>
      </ol>

      <p className="mt-4 rounded-xl border border-brand-violet/25 bg-brand-violet/10 p-3 text-xs text-slate-300">
        <Sparkles size={12} className="mr-1 inline text-brand-violet" />
        Assim que conectar: o follow-up automático pós-ligação começa a sair sozinho, as
        respostas dos leads aparecem aqui, e com <code>WHATSAPP_AUTORESPOSTA=1</code> +{" "}
        <code>ANTHROPIC_API_KEY</code> a IA continua a conversa usando o contexto da ligação.
      </p>
    </div>
  );
}

export default function WhatsappConversas({ conversas = [], conectado = false, iaLigada = false, canal = null, estado = null }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const conv = conversas.find((c) => c.telefone === ativo);
  const fimDaLista = useRef(null);

  /*
   * Atualização automática: a conversa precisa andar sozinha, como
   * em qualquer aplicativo de mensagem. A cada 8 segundos a tela
   * busca o que chegou de novo — sem isso o usuário só veria a
   * resposta do lead ao recarregar a página na mão.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      // Não atualiza enquanto está digitando, para não perder o texto
      if (!enviando && !texto) router.refresh();
    }, 8000);
    return () => clearInterval(timer);
  }, [router, enviando, texto]);

  // Rola para a última mensagem quando chega algo novo
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conv?.mensagens?.length, ativo]);

  const fmtTel = (t) =>
    t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t;
  const fmtHora = (iso) =>
    new Date(iso).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });

  const enviar = async () => {
    if (!texto.trim() || !conv || enviando) return;
    setEnviando(true);
    setAviso(null);
    try {
      const resposta = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: conv.telefone, texto }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setAviso(dados.erro || "Não foi possível enviar.");
      } else {
        setTexto("");
        if (dados.aviso) setAviso(dados.aviso);
        router.refresh(); // recarrega as conversas do banco
      }
    } catch {
      setAviso("Falha de conexão.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <PageHeader
        titulo="WhatsApp"
        subtitulo={
          conectado
            ? canal === "zapi"
              ? "Conversas reais do seu número conectado."
              : "Conversas reais pela API oficial da Meta."
            : "Conecte seu número para ativar o follow-up automático."
        }
      >
        {conectado && (
          <span
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-500"
            title="A tela busca mensagens novas a cada 8 segundos"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            ao vivo
          </span>
        )}

        {conectado && (
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
              iaLigada
                ? "border-brand-violet/40 bg-brand-violet/10 text-brand-violet"
                : "border-white/10 text-slate-500"
            }`}
          >
            <Sparkles size={12} /> IA respondendo: {iaLigada ? "ligada" : "desligada"}
          </span>
        )}
      </PageHeader>

      {!conectado && <GuiaConexao />}

      {/* Estado real da instância, verificado na origem */}
      {conectado && canal === "zapi" && estado && !estado.conectado && (
        <div className="card mb-4 border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-300">
            As chaves estão configuradas, mas o celular não está conectado.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Abra o painel da Z-API, vá em Instâncias Web e leia o QR code com o
            aparelho. Enquanto isso, nenhuma mensagem entra nem sai.
            {estado.motivo && (
              <>
                <br />
                <span className="text-slate-600">Retorno: {estado.motivo}</span>
              </>
            )}
          </p>
        </div>
      )}

      {conectado && canal === "zapi" && estado?.conectado && !estado.celularOnline && (
        <p className="card mb-4 border-amber-500/20 p-3 text-xs text-amber-300/90">
          A instância está ativa, mas o celular aparece offline. Se ele ficar sem
          internet ou desligado, as mensagens param de sair.
        </p>
      )}

      {conectado && (
        <div className="card flex overflow-hidden" style={{ minHeight: 440 }}>
          {/* Lista de conversas */}
          <div
            className={`w-full shrink-0 flex-col border-r border-white/5 sm:w-72 ${
              ativo ? "hidden sm:flex" : "flex"
            }`}
          >
            {conversas.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                <CheckCircle2
                  size={22}
                  className={
                    canal === "zapi" && estado && !estado.conectado
                      ? "text-slate-600"
                      : "text-emerald-400"
                  }
                />
                <p className="text-sm font-medium text-white">
                  {canal === "zapi" && estado && !estado.conectado
                    ? "Aguardando conexão do celular"
                    : "Número conectado!"}
                </p>
                <p className="text-xs text-slate-500">
                  As conversas aparecem aqui quando o follow-up automático disparar ou um lead
                  responder.
                </p>
              </div>
            )}
            {conversas.map((c) => {
              const ultima = c.mensagens[c.mensagens.length - 1];
              return (
                <button
                  key={c.telefone}
                  onClick={() => setAtivo(c.telefone)}
                  className={`flex items-center gap-3 border-b border-white/5 p-3.5 text-left transition hover:bg-navy-900 ${
                    ativo === c.telefone ? "bg-navy-800" : ""
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-navy-800 text-xs font-bold text-slate-300">
                    {(c.nome || c.telefone).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className="truncate text-sm font-semibold text-white">
                        {c.nome || fmtTel(c.telefone)}
                      </p>
                      <span className="ml-2 shrink-0 text-xs text-slate-500">
                        {fmtHora(ultima.criado_em)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{ultima.texto}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chat */}
          <div className={`flex-1 flex-col ${ativo ? "flex" : "hidden sm:flex"}`}>
            {conv ? (
              <>
                <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
                  <button onClick={() => setAtivo(null)} className="text-slate-500 sm:hidden">
                    <ArrowLeft size={18} />
                  </button>
                  <p className="text-sm font-semibold text-white">
                    {conv.nome || fmtTel(conv.telefone)}
                  </p>
                  <span className="text-xs text-slate-600">{fmtTel(conv.telefone)}</span>
                </div>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
                  {conv.mensagens.map((m, i) => (
                    <div
                      key={i}
                      className={`max-w-xs rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        m.direcao === "out"
                          ? "self-end bg-gradient-to-r from-brand-blue to-brand-violet text-white"
                          : "self-start border border-white/10 bg-navy-800 text-slate-200"
                      }`}
                    >
                      {m.texto}
                      <span className="mt-1 block text-right text-[10px] opacity-60">
                        {fmtHora(m.criado_em)}
                      </span>
                    </div>
                  ))}
                  <div ref={fimDaLista} />
                </div>

                {aviso && (
                  <p className="border-t border-white/5 px-4 py-2 text-xs text-amber-300">
                    {aviso}
                  </p>
                )}

                <div className="flex items-center gap-2 border-t border-white/5 p-3">
                  <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && enviar()}
                    placeholder="Digite uma mensagem..."
                    className="campo flex-1 text-sm"
                  />
                  <button
                    onClick={enviar}
                    disabled={enviando}
                    className="btn-primario !h-10 !w-10 !p-0"
                  >
                    {enviando ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
                Selecione uma conversa ao lado
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
