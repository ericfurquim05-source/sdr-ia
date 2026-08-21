"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Clock, RefreshCw, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/Interface";

/* Link "Adicionar ao Google Agenda" de um evento (abre pré-preenchido) */
function linkGoogle(e) {
  const ini = new Date(e.inicio);
  const fim = new Date(ini.getTime() + 3600000);
  const fmt = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.titulo,
    dates: `${fmt(ini)}/${fmt(fim)}`,
    details: "Reunião agendada pela SDR IA" + (e.telefone ? ` · ${e.telefone}` : ""),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/* Card de sincronização com o Google Agenda (URL secreta iCal) */
function SincronizarGoogle({ conectado }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [url, setUrl] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const salvar = async (valor) => {
    setEnviando(true);
    setAviso(null);
    try {
      const r = await fetch("/api/agenda/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: valor }),
      });
      const d = await r.json();
      setAviso({ erro: !r.ok, texto: d.mensagem || d.erro });
      if (r.ok) {
        setUrl("");
        setAberto(false);
        router.refresh();
      }
    } catch {
      setAviso({ erro: true, texto: "Falha de conexão." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="card mb-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex items-center gap-1.5 text-sm font-medium ${conectado ? "text-emerald-400" : "text-slate-300"}`}>
          {conectado ? <CheckCircle2 size={15} /> : <RefreshCw size={15} />}
          {conectado ? "Google Agenda conectado" : "Sincronizar com Google Agenda"}
        </span>
        <p className="flex-1 text-xs text-slate-500">
          {conectado
            ? "A IA consulta seus compromissos do Google ao vivo e só oferece horários realmente livres."
            : "Conecte para a IA respeitar seus compromissos do Google ao oferecer horários."}
        </p>
        <button onClick={() => setAberto(!aberto)} className="btn-fantasma text-xs">
          {conectado ? "Alterar" : "Conectar"}
        </button>
      </div>

      {aberto && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="mb-2 text-xs text-slate-400">
            No Google Agenda: engrenagem → <b>Configurações</b> → clique na sua agenda →{" "}
            <b>Integrar agenda</b> → copie o <b>Endereço secreto no formato iCal</b> e cole aqui:
          </p>
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              className="campo flex-1 text-xs"
            />
            <button
              onClick={() => salvar(url)}
              disabled={enviando || !url.trim()}
              className="btn-primario !py-2 text-xs"
            >
              {enviando ? <Loader2 size={13} className="animate-spin" /> : "Salvar"}
            </button>
            {conectado && (
              <button onClick={() => salvar("")} disabled={enviando} className="btn-fantasma text-xs">
                Desconectar
              </button>
            )}
          </div>
        </div>
      )}

      {aviso && (
        <p className={`mt-3 text-xs ${aviso.erro ? "text-rose-300" : "text-emerald-300"}`}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}

/*
 * Grade mensal com os eventos reais recebidos por props.
 * Dots violeta = reunião marcada pela IA · azul = manual.
 * Fins de semana aparecem bloqueados (fora do horário de atendimento).
 */
export default function CalendarioGrade({ eventos, livres = [], googleConectado = false }) {
  const hoje = new Date();
  const [mesBase, setMesBase] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaSel, setDiaSel] = useState(hoje.getDate());

  const ano = mesBase.getFullYear();
  const mes = mesBase.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const nomeMes = mesBase.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Agrupa os eventos por dia do mês exibido
  const porDia = new Map();
  for (const e of eventos) {
    // Data em Brasília (aaaa-mm-dd), independente do fuso do navegador
    const [aa, mm, dd] = new Date(e.inicio)
      .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
      .split("-")
      .map(Number);
    if (aa === ano && mm - 1 === mes) {
      const dia = dd;
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia).push(e);
    }
  }

  const celulas = [...Array(primeiroDia).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)];
  const evDia = (porDia.get(diaSel) ?? []).sort((a, b) => a.inicio.localeCompare(b.inicio));

  // Grade de horários do dia selecionado: 8h às 20h (última reunião às 20h)
  const dataSel = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaSel).padStart(2, "0")}`;
  const horasLivresDoDia = new Set(
    livres.filter((l) => l.data === dataSel).map((l) => l.hora)
  );
  const horaOcupada = new Map(
    evDia.map((e) => [
      new Date(e.inicio).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
      }),
      e,
    ])
  );
  // Só as horas dentro das janelas de reunião entram na grade.
  // As faixas vêm do servidor (mesmas que a Lara usa na ligação).
  const horasDaGrade = [...new Set(livres.map((l) => Number(l.hora.slice(0, 2))))].sort(
    (a, b) => a - b
  );
  const faixas = horasDaGrade.length ? horasDaGrade : [8, 9, 10, 14, 15, 16, 17, 18];
  const gradeDoDia = faixas.map((h) => {
    const hora = `${String(h).padStart(2, "0")}:00`;
    const evento = horaOcupada.get(hora);
    return { hora, evento, livre: !evento && horasLivresDoDia.has(hora) };
  });
  const domingoSel = new Date(ano, mes, diaSel).getDay() === 0;

  const mudarMes = (delta) => {
    setMesBase(new Date(ano, mes + delta, 1));
    setDiaSel(1);
  };

  const fmtHora = (iso) =>
    new Date(iso).toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <PageHeader
        titulo="Calendário"
        subtitulo="Reuniões marcadas pela IA entram aqui sozinhas, em violeta."
      />

      <SincronizarGoogle conectado={googleConectado} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-semibold capitalize text-white">{nomeMes}</p>
            <div className="flex gap-2">
              <button onClick={() => mudarMes(-1)} className="btn-fantasma !px-3 !py-1.5">‹</button>
              <button onClick={() => mudarMes(1)} className="btn-fantasma !px-3 !py-1.5">›</button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {celulas.map((d, i) => {
              if (!d) return <div key={i} />;
              const dow = new Date(ano, mes, d).getDay();
              const bloqueado = dow === 0; // só domingo bloqueado
              const tem = porDia.get(d);
              const selecionado = d === diaSel;
              const ehHoje =
                d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();

              return (
                <button
                  key={i}
                  disabled={bloqueado}
                  onClick={() => setDiaSel(d)}
                  className={`relative h-11 rounded-lg text-sm transition
                    ${bloqueado ? "cursor-not-allowed text-slate-700" : "text-slate-300 hover:bg-navy-800"}
                    ${selecionado ? "bg-gradient-to-br from-brand-blue to-brand-violet font-semibold text-white" : ""}
                    ${ehHoje && !selecionado ? "border border-brand-blue" : ""}`}
                >
                  {d}
                  {tem && (
                    <span
                      className={`absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                        tem[0].origem === "ia" ? "bg-brand-violet" : "bg-brand-blue"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Clock size={12} /> Reuniões de segunda a sábado, das 8h às 11h e das 14h às 19h
          </p>
        </div>

        <div className="card p-5">
          <p className="mb-1 font-semibold text-white">Dia {diaSel}</p>
          <p className="mb-4 text-xs text-slate-500">
            {domingoSel
              ? "Domingo — sem atendimento"
              : `${gradeDoDia.filter((g) => g.livre).length} horários livres · ${evDia.length} ocupados`}
          </p>

          {/* Grade hora a hora: o que a Lara enxerga ao oferecer horário */}
          {!domingoSel && (
            <div className="mb-4 flex flex-col gap-1">
              {gradeDoDia.map((g) => (
                <div
                  key={g.hora}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${
                    g.evento
                      ? "border border-brand-violet/30 bg-brand-violet/10"
                      : g.livre
                        ? "border border-emerald-500/20 bg-emerald-500/5"
                        : "border border-white/5 bg-navy-900"
                  }`}
                >
                  <span className="w-11 shrink-0 font-mono text-slate-400">{g.hora}</span>
                  {g.evento ? (
                    <span className="truncate text-slate-200">{g.evento.titulo}</span>
                  ) : g.livre ? (
                    <span className="text-emerald-400">livre</span>
                  ) : (
                    <span className="text-slate-600">indisponível</span>
                  )}
                </div>
              ))}
              <p className="mt-2 text-xs text-slate-600">
                &quot;Indisponível&quot; = já passou ou está ocupado no seu Google Agenda. Fora
                dessas faixas a Lara não oferece reunião.
              </p>
            </div>
          )}

          {evDia.length === 0 && !domingoSel && (
            <p className="text-sm text-slate-500">Nenhum compromisso neste dia.</p>
          )}
          <div className="flex flex-col gap-3">
            {evDia.map((e) => (
              <div
                key={e.id}
                className={`rounded-xl border p-3 ${
                  e.origem === "ia"
                    ? "border-brand-violet/35 bg-brand-violet/10"
                    : "border-white/10 bg-navy-800"
                }`}
              >
                <p className="mb-1 text-xs font-semibold text-slate-300">{fmtHora(e.inicio)}</p>
                <p className="text-sm leading-snug text-white">{e.titulo}</p>
                {e.telefone && <p className="mt-1 text-xs text-slate-500">{e.telefone}</p>}
                {e.origem === "ia" && (
                  <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-violet">
                    <Sparkles size={11} /> Agendado pela IA
                  </p>
                )}
                <a
                  href={linkGoogle(e)}
                  target="_blank"
                  className="mt-2 flex items-center gap-1 text-xs text-slate-500 transition hover:text-brand-blue"
                >
                  <ExternalLink size={11} /> Adicionar ao Google Agenda
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
