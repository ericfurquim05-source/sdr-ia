"use client";

import { useMemo, useState } from "react";
import {
  FileSpreadsheet, CheckCircle2, AlertTriangle, Copy, Download, X,
} from "lucide-react";
import { montarContatos, formatarExibicao } from "@/lib/planilha";

/*
 * PAINEL DE CONFERÊNCIA DA PLANILHA
 * O cliente sobe a planilha do jeito que ela veio; aqui o site
 * mostra o que entendeu, deixa corrigir as colunas na mão e
 * exibe o que será ignorado (inválidos e duplicados) antes
 * de qualquer ligação sair.
 */
export default function ConferenciaPlanilha({ analise, arquivo, onPronto, onRemover }) {
  const [mapa, setMapa] = useState(analise.mapa);

  // Recalcula a conversão sempre que o cliente troca uma coluna
  const resultado = useMemo(() => montarContatos(analise.linhas, mapa), [analise.linhas, mapa]);

  // Avisa a tela de Campanhas a cada mudança
  useMemo(() => onPronto(resultado.contatos), [resultado.contatos]);

  const baixarCorrigida = () => {
    const linhas = [
      "NOME,TELEFONE,TENTATIVAS,STATUS",
      ...resultado.contatos.map((c) => `"${c.nome.replace(/"/g, '""')}",${c.telefone},0,PENDENTE`),
    ];
    const blob = new Blob(["\uFEFF" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lista-padronizada.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const Seletor = ({ campo, rotulo }) => (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-xs text-slate-500">{rotulo}</span>
      <select
        value={mapa[campo]}
        onChange={(e) => setMapa({ ...mapa, [campo]: Number(e.target.value) })}
        className="campo text-sm"
      >
        <option value={-1}>— nenhuma —</option>
        {analise.colunas.map((c, i) => (
          <option key={i} value={i}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Arquivo */}
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-navy-900 p-3">
        <FileSpreadsheet size={22} className="shrink-0 text-brand-blue" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{arquivo.name}</p>
          <p className="text-xs text-slate-500">
            {analise.linhas.length} linhas lidas · {analise.colunas.length} colunas
          </p>
        </div>
        <button onClick={onRemover} className="text-slate-500 transition hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Mapeamento de colunas */}
      <div>
        <p className="mb-2 text-sm font-medium text-white">
          Confira o que o site entendeu da sua planilha
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Seletor campo="nome" rotulo="Coluna do NOME" />
          <Seletor campo="telefone" rotulo="Coluna do TELEFONE" />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Detectamos automaticamente — troque só se algo estiver errado.
        </p>
      </div>

      {/* Prévia da conversão */}
      {resultado.contatos.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-2 bg-navy-800 px-3 py-2 text-xs font-semibold text-slate-400">
            <span>Nome</span>
            <span>Telefone padronizado</span>
          </div>
          {resultado.contatos.slice(0, 4).map((c, i) => (
            <div key={i} className="grid grid-cols-2 border-t border-white/5 px-3 py-2 text-sm">
              <span className="truncate text-slate-300">{c.nome || "—"}</span>
              <span className="text-slate-300">{formatarExibicao(c.telefone)}</span>
            </div>
          ))}
          {resultado.contatos.length > 4 && (
            <p className="border-t border-white/5 px-3 py-2 text-xs text-slate-500">
              + {resultado.contatos.length - 4} contatos
            </p>
          )}
        </div>
      )}

      {/* Placar da conversão */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-center">
          <p className="font-display text-2xl font-bold text-emerald-300">
            {resultado.contatos.length}
          </p>
          <p className="text-xs text-emerald-400/80">prontos para ligar</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-navy-900 p-3 text-center">
          <p className="font-display text-2xl font-bold text-slate-300">
            {resultado.duplicados.length}
          </p>
          <p className="text-xs text-slate-500">duplicados removidos</p>
        </div>
        <div
          className={`rounded-xl border p-3 text-center ${
            resultado.invalidos.length
              ? "border-amber-500/25 bg-amber-500/10"
              : "border-white/10 bg-navy-900"
          }`}
        >
          <p
            className={`font-display text-2xl font-bold ${
              resultado.invalidos.length ? "text-amber-300" : "text-slate-300"
            }`}
          >
            {resultado.invalidos.length}
          </p>
          <p className="text-xs text-slate-500">números inválidos</p>
        </div>
      </div>

      {/* Detalhe dos inválidos */}
      {resultado.invalidos.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <AlertTriangle size={13} /> Estas linhas serão ignoradas
          </p>
          <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
            {resultado.invalidos.slice(0, 12).map((l, i) => (
              <p key={i} className="text-xs text-slate-400">
                {l.nome || "sem nome"} — <span className="text-amber-300/80">{l.bruto}</span>
              </p>
            ))}
            {resultado.invalidos.length > 12 && (
              <p className="text-xs text-slate-600">
                + {resultado.invalidos.length - 12} linhas
              </p>
            )}
          </div>
        </div>
      )}

      {resultado.contatos.length === 0 && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          Nenhum telefone válido encontrado. Confira se a coluna do telefone está correta acima.
        </p>
      )}

      {resultado.contatos.length > 0 && (
        <button onClick={baixarCorrigida} className="btn-fantasma self-start text-xs">
          <Download size={13} /> Baixar planilha padronizada
        </button>
      )}
    </div>
  );
}
