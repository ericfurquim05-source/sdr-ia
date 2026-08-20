"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Play, Pause, Clock, ArrowUpDown, Timer, DownloadCloud, Loader2 } from "lucide-react";
import { PageHeader, StatusBadge } from "@/components/Interface";
import FiltroPeriodo from "@/components/FiltroPeriodo";
import { detectarSinais, ehOportunidade } from "@/lib/sinais";

/*
 * Lista de chamadas REAIS (tabela ligacoes): player com a gravação
 * da Retell, resumo da IA e transcrição completa.
 */

function PlayerReal({ url }) {
  const [audio] = useState(() => (typeof Audio !== "undefined" ? new Audio(url) : null));
  const [tocando, setTocando] = useState(false);

  const alternar = () => {
    if (!audio) return;
    if (tocando) {
      audio.pause();
      setTocando(false);
    } else {
      audio.play();
      setTocando(true);
      audio.onended = () => setTocando(false);
    }
  };

  return (
    <button
      onClick={alternar}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-navy-900 px-3 py-2 text-sm text-slate-300 transition hover:border-brand-blue/50"
    >
      {tocando ? <Pause size={14} /> : <Play size={14} />}
      {tocando ? "Pausar gravação" : "Ouvir gravação"}
    </button>
  );
}

// A Retell manda a transcrição como texto "Agent: ...\nUser: ..."
function Transcricao({ texto }) {
  const linhas = String(texto)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-xl border border-white/5 bg-navy-900 p-3">
      {linhas.map((linha, i) => {
        const ehIA = /^(agent|assistant|ia)\s*:/i.test(linha);
        const ehLead = /^(user|lead|cliente)\s*:/i.test(linha);
        const conteudo = linha.replace(/^(agent|assistant|ia|user|lead|cliente)\s*:\s*/i, "");
        return (
          <p key={i} className="text-sm leading-relaxed text-slate-300">
            {(ehIA || ehLead) && (
              <span className={`font-semibold ${ehIA ? "text-brand-violet" : "text-brand-blue"}`}>
                {ehIA ? "IA" : "Lead"}:{" "}
              </span>
            )}
            {conteudo}
          </p>
        );
      })}
    </div>
  );
}

const OPCOES_ORDEM = [
  { id: "duracao_desc", rotulo: "Maior duração" },
  { id: "duracao_asc", rotulo: "Menor duração" },
  { id: "recentes", rotulo: "Mais recentes" },
  { id: "antigas", rotulo: "Mais antigas" },
];

export default function ChamadasReais({ ligacoes, de, ate, ordem, totais }) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("Todas");
  const [aberto, setAberto] = useState(ligacoes[0]?.id ?? null);

  const chips = ["Todas", "Oportunidades", "Atendida", "Não atendida"];

  // Etiquetas detectadas na conversa (projeto futuro, pediu WhatsApp, etc.)
  const sinaisDe = (l) => detectarSinais(l);

  const trocarOrdem = (novaOrdem) => {
    router.push(`/sdr-ia?de=${de}&ate=${ate}&ordem=${novaOrdem}`);
  };

  const minutosTotais = Math.round((totais?.msTotal ?? 0) / 60000);

  // Traz para o site as ligações que a Retell já tem gravadas
  const [importando, setImportando] = useState(false);
  const [avisoImport, setAvisoImport] = useState(null);

  const importarHistorico = async () => {
    setImportando(true);
    setAvisoImport(null);
    try {
      const r = await fetch("/api/importar/retell");
      const d = await r.json();
      setAvisoImport(d.mensagem || d.erro);
      if (r.ok) router.refresh();
    } catch {
      setAvisoImport("Falha ao importar. Tente de novo.");
    } finally {
      setImportando(false);
    }
  };

  const statusDe = (l) => (l.sucesso ? "Atendida" : "Não atendida");

  const lista = ligacoes.filter((l) => {
    const okFiltro =
      filtro === "Todas" ||
      (filtro === "Oportunidades" ? ehOportunidade(sinaisDe(l)) : statusDe(l) === filtro);
    const okBusca = (l.nome + " " + l.telefone).toLowerCase().includes(busca.toLowerCase());
    return okFiltro && okBusca;
  });

  const totalOportunidades = ligacoes.filter((l) => ehOportunidade(sinaisDe(l))).length;

  const fmtHora = (iso) =>
    new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const fmtDuracao = (ms) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <>
      <PageHeader
        titulo="SDR IA"
        subtitulo="Histórico real das ligações — gravação, resumo e transcrição."
      >
        <FiltroPeriodo de={de} ate={ate} base="/sdr-ia" extra={`&ordem=${ordem}`} />
        <button onClick={importarHistorico} disabled={importando} className="btn-fantasma text-sm">
          {importando ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloud size={14} />}
          Importar da Retell
        </button>
      </PageHeader>

      {avisoImport && (
        <p className="card mb-4 border-brand-blue/30 p-3 text-sm text-slate-300">{avisoImport}</p>
      )}

      {/* Resumo do período selecionado */}
      <div className="card mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="text-slate-400">
          <b className="text-white">{totais?.total ?? 0}</b> ligações no período
        </span>
        <span className="text-slate-400">
          <b className="text-emerald-300">{totais?.atendidas ?? 0}</b> atendidas
        </span>
        <span className="text-slate-400">
          <b className="text-amber-300">{totalOportunidades}</b> oportunidades
        </span>
        <span className="flex items-center gap-1.5 text-slate-400">
          <Timer size={13} /> <b className="text-white">{minutosTotais}</b> min no total
        </span>
      </div>

      {/* Ordenação */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <ArrowUpDown size={13} /> Ordenar por:
        </span>
        {OPCOES_ORDEM.map((o) => (
          <button
            key={o.id}
            onClick={() => trocarOrdem(o.id)}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              ordem === o.id
                ? "bg-gradient-to-r from-brand-blue to-brand-violet text-white"
                : "border border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="campo flex flex-1 items-center gap-2 !py-2.5">
          <Search size={15} className="text-slate-500" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => setFiltro(c)}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs transition ${
                filtro === c
                  ? "bg-gradient-to-r from-brand-blue to-brand-violet text-white"
                  : "border border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">
          Nenhuma ligação neste período. Ajuste o filtro de data acima ou aguarde a
          campanha rodar.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {lista.map((l) => {
          const sinais = sinaisDe(l);
          const quente = ehOportunidade(sinais);
          return (
          <div
            key={l.id}
            className={`card overflow-hidden ${quente ? "border-amber-400/40" : ""}`}
          >
            <button
              onClick={() => setAberto(aberto === l.id ? null : l.id)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-navy-800 text-sm font-bold text-slate-300">
                {(l.nome || l.telefone)
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {l.nome || "Sem nome"}{" "}
                  <span className="font-normal text-slate-500">· {l.telefone}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  {fmtHora(l.criado_em)} ·
                  <span
                    className={`inline-flex items-center gap-1 font-semibold ${
                      l.duracao_ms > 60000 ? "text-emerald-400" : "text-slate-400"
                    }`}
                  >
                    <Clock size={11} /> {fmtDuracao(l.duracao_ms)}
                  </span>
                  · {l.motivo}
                </p>
              </div>
              <StatusBadge status={l.sucesso ? "Atendida" : "Não atendida"} />
            </button>

            {/* Etiquetas da conversa — estilo post-it */}
            {sinais.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                {sinais.map((s) => (
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
            )}

            {aberto === l.id && (
              <div className="flex flex-col gap-3 px-4 pb-4">
                {l.recording_url ? (
                  <PlayerReal url={l.recording_url} />
                ) : (
                  <p className="text-xs italic text-slate-500">
                    Sem gravação disponível para esta chamada.
                  </p>
                )}

                {l.resumo && (
                  <div className="rounded-xl border border-brand-violet/30 bg-brand-violet/10 p-3">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-brand-violet">
                      <Sparkles size={12} /> Resumo da IA
                    </p>
                    <p className="text-sm leading-relaxed text-slate-200">{l.resumo}</p>
                  </div>
                )}

                {l.transcript && <Transcricao texto={l.transcript} />}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </>
  );
}
