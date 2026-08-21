"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [modo, setModo] = useState("entrar"); // entrar | cadastrar
  const [form, setForm] = useState({ nome: "", empresa: "", email: "", senha: "" });
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const campo = (chave) => ({
    value: form[chave],
    onChange: (e) => setForm({ ...form, [chave]: e.target.value }),
  });

  // Pede o link de redefinição para o e-mail informado
  const recuperar = async () => {
    if (!form.email) {
      setErro("Digite seu e-mail acima para receber o link.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const d = await r.json();
      setErro(d.mensagem || "Solicitação registrada.");
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setEnviando(false);
    }
  };

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const rota = modo === "entrar" ? "/api/auth/entrar" : "/api/auth/cadastrar";
      const resposta = await fetch(rota, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro || "Não foi possível continuar.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Marca */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-violet">
            <Sparkles size={22} className="text-white" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-white">SDR IA</h1>
          <p className="mt-1 text-sm text-slate-500">Prospecção por voz com inteligência artificial</p>
        </div>

        <div className="card p-6">
          {/* Alternância entrar / cadastrar */}
          <div className="mb-5 flex rounded-xl bg-navy-900 p-1">
            {[
              ["entrar", "Entrar"],
              ["cadastrar", "Criar conta"],
            ].map(([id, rotulo]) => (
              <button
                key={id}
                onClick={() => {
                  setModo(id);
                  setErro(null);
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                  modo === id
                    ? "bg-gradient-to-r from-brand-blue to-brand-violet text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {modo === "cadastrar" && (
              <>
                <input className="campo" placeholder="Seu nome" {...campo("nome")} />
                <input className="campo" placeholder="Nome da empresa" {...campo("empresa")} />
              </>
            )}
            <input
              className="campo"
              type="email"
              autoComplete="email"
              placeholder="E-mail"
              {...campo("email")}
            />
            <input
              className="campo"
              type="password"
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              placeholder="Senha"
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              {...campo("senha")}
            />

            {erro && (
              <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {erro}
              </p>
            )}

            <button onClick={enviar} disabled={enviando} className="btn-primario mt-1 w-full !py-3">
              {enviando && <Loader2 size={16} className="animate-spin" />}
              {modo === "entrar" ? "Entrar" : "Criar minha conta"}
            </button>

            {modo === "entrar" && (
              <button
                onClick={recuperar}
                className="mt-1 text-center text-xs text-slate-500 transition hover:text-brand-blue"
              >
                Esqueci minha senha
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Modelo pré-pago — você paga apenas pelos minutos falados.
        </p>
      </div>
    </div>
  );
}
