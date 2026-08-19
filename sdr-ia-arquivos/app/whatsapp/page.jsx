"use client";

import { useState } from "react";
import { Send, ChevronLeft, Plug, Info } from "lucide-react";
import { PageHeader } from "@/components/Interface";
import { conversas as conversasIniciais } from "@/lib/dados";

/*
 * OBSERVAÇÃO TÉCNICA IMPORTANTE:
 * O WhatsApp Web não permite ser embutido via <iframe> (bloqueio do próprio
 * WhatsApp por X-Frame-Options). Por isso, esta tela já entrega a interface
 * de chat completa dentro da plataforma, pronta para receber mensagens da
 * WhatsApp Business API oficial (Meta Cloud API) ou de provedores como
 * Z-API / Twilio — basta plugar o backend nos pontos marcados com TODO.
 */
export default function WhatsApp() {
  const [conversas, setConversas] = useState(conversasIniciais);
  const [ativa, setAtiva] = useState(null); // id da conversa aberta
  const [texto, setTexto] = useState("");
  const [mostrarInfo, setMostrarInfo] = useState(false);

  const conversa = conversas.find((c) => c.id === ativa);

  const enviar = () => {
    if (!texto.trim() || !conversa) return;
    const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setConversas((lista) =>
      lista.map((c) =>
        c.id === conversa.id
          ? {
              ...c,
              ultima: texto,
              hora,
              mensagens: [...c.mensagens, { de: "eu", texto, hora }],
            }
          : c
      )
    );
    setTexto("");
    // TODO: enviar via WhatsApp Business API
    // await fetch("/api/whatsapp/enviar", { method: "POST", body: JSON.stringify({ para: conversa.id, texto }) })
  };

  return (
    <>
      <PageHeader titulo="WhatsApp" subtitulo="Atenda seus leads sem sair da plataforma.">
        <button onClick={() => setMostrarInfo(!mostrarInfo)} className="btn-primario">
          <Plug size={15} /> Conectar número
        </button>
      </PageHeader>

      {mostrarInfo && (
        <div className="card mb-5 flex items-start gap-3 border-brand-blue/30 p-4 text-sm">
          <Info size={17} className="mt-0.5 shrink-0 text-brand-blue" />
          <p className="text-slate-400">
            Esta tela está em <span className="text-slate-200">modo demonstração</span>. Para ativar,
            conecte um número da WhatsApp Business API (Meta Cloud API, Z-API ou Twilio) nas rotas de
            backend já preparadas — os pontos de integração estão comentados no código.
          </p>
        </div>
      )}

      <div className="card grid h-[calc(100vh-16rem)] min-h-[28rem] grid-cols-1 overflow-hidden md:grid-cols-3">
        {/* Lista de conversas */}
        <div
          className={`flex-col border-white/5 md:border-r ${ativa ? "hidden md:flex" : "flex"}`}
        >
          <div className="border-b border-white/5 p-4">
            <h2 className="font-display font-semibold text-white">Conversas</h2>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {conversas.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setAtiva(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/5 ${
                    ativa === c.id ? "bg-white/5" : ""
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/30 to-brand-blue/30 font-display text-sm font-semibold text-white">
                    {c.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-slate-200">{c.nome}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">{c.hora}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-slate-500">{c.ultima}</span>
                      {c.naoLidas > 0 && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-navy-950">
                          {c.naoLidas}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Chat ativo */}
        <div className={`flex-col md:col-span-2 ${ativa ? "flex" : "hidden md:flex"}`}>
          {conversa ? (
            <>
              <div className="flex items-center gap-3 border-b border-white/5 p-4">
                <button
                  onClick={() => setAtiva(null)}
                  aria-label="Voltar para as conversas"
                  className="md:hidden"
                >
                  <ChevronLeft size={20} className="text-slate-400" />
                </button>
                <span className="font-medium text-white">{conversa.nome}</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online
                </span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {conversa.mensagens.map((m, i) => (
                  <div key={i} className={`flex ${m.de === "eu" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.de === "eu"
                          ? "rounded-br-md bg-gradient-to-r from-brand-blue to-brand-violet text-white"
                          : "rounded-bl-md bg-navy-800 text-slate-200"
                      }`}
                    >
                      <p>{m.texto}</p>
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          m.de === "eu" ? "text-white/70" : "text-slate-500"
                        }`}
                      >
                        {m.hora}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-white/5 p-3">
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && enviar()}
                  placeholder="Escreva uma mensagem"
                  className="campo flex-1"
                />
                <button
                  onClick={enviar}
                  aria-label="Enviar mensagem"
                  className="btn-primario !rounded-full !p-3"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="font-display text-lg font-semibold text-white">Selecione uma conversa</p>
              <p className="max-w-xs text-sm text-slate-500">
                As mensagens dos seus leads aparecem aqui assim que o número for conectado.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
