"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock, Hand, Check, Undo2, Phone, Sparkles, Loader2, CalendarCheck, XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/Interface";
import { formatarExibicao } from "@/lib/planilha";
import { detectarSinais, nivelPrioridade } from "@/lib/sinais";

/*
 * QUADRO DE LEADS DA EQUIPE
 * O contato nasce livre. Quem assume tira dos outros, então
 * ninguém liga duas vezes para a mesma pessoa.
 *
 * O TELEFONE FICA OCULTO até alguém assumir: antes disso a pessoa
 * decide pelo contexto da conversa, não escolhendo número para
 * anotar. Depois de assumir, o número aparece.
 */
export default function QuadroLeads({ leads = [], meuId = null, souGestor = false }) {
  const router = useRouter();
  const [aba, setAba] = useState("livres");
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [aberto, setAberto] = useState(null);

  const livres = leads.filter((l) => !l.assumido_por);
  const meus = leads.filter((l) => l.assumido_por === meuId && !l.desfecho_equipe);
  const concluidos = leads.filter((l) => l.assumido_por === meuId && l.desfecho_equipe);
  const lista = aba === "livres" ? livres : aba === "meus" ? meus : concluidos;

  const agir = async (acao, ligacaoId, desfecho = null) => {
    setOcupado(`${acao}-${ligacaoId}`);
    setAviso(null);
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, ligacaoId, desfecho, usuarioId: meuId }),
      });
      const d = await r.json();
      setAviso({ erro: !r.ok, texto: d.mensagem || d.erro });
      if (r.ok) {
        if (acao === "assumir") setAba("meus");
        router.refresh();
      }
    } catch {
      setAviso({ erro: true, texto: "Falha de conexão." });
    } finally {
      setOcupado(null);
    }
  };

  const fmtData = (iso) =>
    new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const fmtDuracao = (ms) => {
    const s = Math.round((ms || 0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const abas = [
    ["livres", "Disponíveis", livres.length],
    ["meus", "Meus contatos", meus.length],
    ["concluidos", "Concluídos", concluidos.length],
  ];

  return (
    <>
      <PageHeader
        titulo="Contatos para atender"
        subtitulo="Assuma um contato para ver o telefone e falar com ele."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {abas.map(([id, rotulo, total]) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`rounded-full px-4 py-2 text-sm transition ${
              aba === id
                ? "bg-gradient-to-r from-brand-blue to-brand-violet text-white"
                : "border border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {rotulo} ({total})
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

      {lista.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-400">
            {aba === "livres"
              ? "Nenhum contato disponível no momento."
              : aba === "meus"
                ? "Você ainda não assumiu nenhum contato."
                : "Nenhum contato concluído ainda."}
          </p>
          {aba === "livres" && (
            <p className="mt-1 text-xs text-slate-600">
              Assim que a IA conseguir uma conversa boa, ela aparece aqui.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {lista.map((l) => {
          const sinais = detectarSinais(l);
          const nivel = nivelPrioridade(sinais, l.duracao_ms);
          const meu = l.assumido_por === meuId;
          const expandido = aberto === l.id;

          return (
            <div
              key={l.id}
              className={`card overflow-hidden ${
                nivel === "alta" ? "border-rose-400/40" : ""
              }`}
            >
              <div className="flex flex-wrap items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{l.nome || "Contato sem nome"}</p>

                  {/* O telefone só aparece depois de assumir */}
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm">
                    {meu ? (
                      <>
                        <Phone size={12} className="text-emerald-400" />
                        <a
                          href={`tel:+55${l.telefone}`}
                          className="font-mono text-emerald-300 hover:underline"
                        >
                          {formatarExibicao(l.telefone)}
                        </a>
                      </>
                    ) : (
                      <>
                        <Lock size={12} className="text-slate-600" />
                        <span className="text-slate-600">
                          telefone liberado ao assumir
                        </span>
                      </>
                    )}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {fmtData(l.criado_em)} · conversou {fmtDuracao(l.duracao_ms)}
                  </p>

                  {/* Etiquetas do que rolou na conversa */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {nivel === "alta" && (
                      <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-300 ring-1 ring-rose-500/40">
                        PRIORIDADE ALTA
                      </span>
                    )}
                    {sinais.slice(0, 3).map((s) => (
                      <span
                        key={s.id}
                        className="rounded-md px-2 py-0.5 text-xs font-semibold"
                        style={{
                          background: `${s.cor}22`,
                          color: s.cor,
                          border: `1px solid ${s.cor}55`,
                        }}
                      >
                        {s.rotulo}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!meu && !l.assumido_por && (
                    <button
                      onClick={() => agir("assumir", l.id)}
                      disabled={ocupado !== null}
                      className="btn-primario !py-2 text-xs"
                    >
                      {ocupado === `assumir-${l.id}` ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Hand size={13} />
                      )}
                      Assumir
                    </button>
                  )}

                  {meu && !l.desfecho_equipe && (
                    <>
                      <button
                        onClick={() => agir("concluir", l.id, "reuniao")}
                        disabled={ocupado !== null}
                        className="btn-fantasma text-xs !text-emerald-300"
                      >
                        <CalendarCheck size={12} /> Marquei reunião
                      </button>
                      <button
                        onClick={() => agir("concluir", l.id, "sem_interesse")}
                        disabled={ocupado !== null}
                        className="btn-fantasma text-xs"
                      >
                        <XCircle size={12} /> Sem interesse
                      </button>
                      <button
                        onClick={() => agir("devolver", l.id)}
                        disabled={ocupado !== null}
                        className="btn-fantasma text-xs !text-slate-500"
                        title="Devolver para a equipe"
                      >
                        <Undo2 size={12} />
                      </button>
                    </>
                  )}

                  {l.desfecho_equipe && (
                    <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-400">
                      <Check size={12} />
                      {l.desfecho_equipe === "reuniao" ? "Reunião marcada" : "Concluído"}
                    </span>
                  )}
                </div>
              </div>

              {/* Resumo do que a IA conversou */}
              {l.resumo && (
                <div className="border-t border-white/5 px-4 py-3">
                  <button
                    onClick={() => setAberto(expandido ? null : l.id)}
                    className="flex items-center gap-1 text-xs font-semibold text-brand-violet"
                  >
                    <Sparkles size={11} /> {expandido ? "Ocultar" : "Ver"} o que foi conversado
                  </button>
                  {expandido && (
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{l.resumo}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
