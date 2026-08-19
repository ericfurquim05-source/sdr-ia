"use client";

import { useRef, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Snowflake,
  Flame,
  Rocket,
  CheckCircle2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/Interface";
import { lerContatos } from "@/lib/planilha";

const agentes = [
  {
    id: "fria",
    nome: "Ligação fria",
    descricao: "Prospecção de novos clientes que ainda não conhecem a empresa.",
    icone: Snowflake,
    cor: "text-brand-cyan",
  },
  {
    id: "quente",
    nome: "Ligação quente",
    descricao: "Leads inbound que vieram do site e já demonstraram interesse.",
    icone: Flame,
    cor: "text-brand-violet",
  },
];

export default function Campanhas() {
  const inputRef = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [contatos, setContatos] = useState(null);
  const [tipoAgente, setTipoAgente] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const receberArquivo = async (file) => {
    if (!file) return;
    setArquivo(file);
    setResultado(null);
    setContatos(null);
    try {
      // Lê a planilha e já normaliza os telefones para o formato +55DDNNNNNNNNN
      const lista = await lerContatos(file);
      setContatos(lista);
      if (lista.length === 0) {
        setResultado({
          erro: true,
          mensagem:
            "Nenhum telefone válido encontrado. A planilha precisa das colunas nome e telefone.",
        });
      }
    } catch {
      setResultado({ erro: true, mensagem: "Não consegui ler essa planilha. Tente salvar como CSV." });
    }
  };

  const executarCampanha = async () => {
    setExecutando(true);
    setResultado(null);
    try {
      // Aciona o backend, que dispara as ligações na Retell AI
      const resposta = await fetch("/api/campanhas/executar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoAgente,
          nomeArquivo: arquivo?.name,
          contatos: contatos ?? [],
          totalContatos: contatos?.length ?? 0,
        }),
      });
      setResultado(await resposta.json());
    } catch {
      setResultado({ erro: true, mensagem: "Não foi possível iniciar a campanha. Tente novamente." });
    } finally {
      setExecutando(false);
    }
  };

  const pronto = arquivo && tipoAgente && contatos && contatos.length > 0;

  return (
    <>
      <PageHeader
        titulo="Campanhas"
        subtitulo="Envie sua lista de contatos, escolha o agente e dispare as ligações."
      />

      <div className="mx-auto max-w-3xl space-y-6">
        {/* 1. Upload da planilha */}
        <section className="card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-white">
            1. Lista de contatos
          </h2>

          {!arquivo ? (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                receberArquivo(e.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
                arrastando
                  ? "border-brand-blue bg-brand-blue/5"
                  : "border-white/10 hover:border-brand-blue/50 hover:bg-white/5"
              }`}
            >
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue/20 to-brand-violet/20">
                <UploadCloud size={26} className="text-brand-blue" />
              </span>
              <p className="font-medium text-slate-200">
                Arraste a planilha aqui ou toque para selecionar
              </p>
              <p className="mt-1 text-sm text-slate-500">
                CSV ou Excel · colunas: nome, telefone
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => receberArquivo(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-2xl border border-brand-blue/30 bg-brand-blue/5 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-800">
                <FileSpreadsheet size={20} className="text-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-200">{arquivo.name}</p>
                <p className="text-sm text-slate-500">
                  {contatos !== null
                    ? `${contatos.length} contatos prontos para ligar`
                    : "Lendo planilha..."}
                </p>
              </div>
              <button
                onClick={() => {
                  setArquivo(null);
                  setContatos(null);
                  setResultado(null);
                }}
                aria-label="Remover arquivo"
                className="btn-fantasma !px-2.5"
              >
                <X size={15} />
              </button>
            </div>
          )}
        </section>

        {/* 2. Seleção obrigatória do agente */}
        <section className="card p-6">
          <h2 className="mb-1 font-display text-lg font-semibold text-white">2. Agente de IA</h2>
          <p className="mb-4 text-sm text-slate-500">
            Escolha o comportamento da IA antes de executar.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {agentes.map(({ id, nome, descricao, icone: Icone, cor }) => {
              const ativo = tipoAgente === id;
              return (
                <button
                  key={id}
                  onClick={() => setTipoAgente(id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    ativo
                      ? "border-brand-blue bg-gradient-to-br from-brand-blue/10 to-brand-violet/10 ring-1 ring-brand-blue/50"
                      : "border-white/10 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-white">
                    <Icone size={17} className={cor} /> {nome}
                    {ativo && <CheckCircle2 size={15} className="ml-auto text-brand-blue" />}
                  </span>
                  <span className="mt-1.5 block text-sm text-slate-400">{descricao}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Disparo */}
        <button
          onClick={executarCampanha}
          disabled={!pronto || executando}
          className="btn-primario w-full !py-4 text-base shadow-glow"
        >
          <Rocket size={18} />
          {executando ? "Colocando ligações na fila..." : "Executar campanha"}
        </button>

        {!pronto && (
          <p className="text-center text-xs text-slate-500">
            Envie a planilha e selecione o agente para liberar o disparo.
          </p>
        )}

        {resultado && !resultado.erro && (
          <div className="card flex items-start gap-3 border-emerald-500/30 p-4">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-400" />
            <div className="text-sm">
              <p className="font-medium text-emerald-300">Campanha na fila!</p>
              <p className="mt-0.5 text-slate-400">{resultado.mensagem}</p>
            </div>
          </div>
        )}

        {resultado?.erro && (
          <div className="card border-rose-500/30 p-4 text-sm text-rose-300">
            {resultado.mensagem}
          </div>
        )}
      </div>
    </>
  );
}
