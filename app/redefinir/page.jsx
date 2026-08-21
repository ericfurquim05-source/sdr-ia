"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";

/* Tela de criação da nova senha, acessada pelo link de recuperação. */
function Formulario() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";

  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const salvar = async () => {
    setErro(null);
    if (senha.length < 6) return setErro("A senha precisa ter ao menos 6 caracteres.");
    if (senha !== repetir) return setErro("As senhas não são iguais.");

    setEnviando(true);
    try {
      const r = await fetch("/api/auth/redefinir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const d = await r.json();
      if (!r.ok) return setErro(d.erro || "Não foi possível redefinir.");
      router.push("/");
      router.refresh();
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setEnviando(false);
    }
  };

  if (!token) {
    return (
      <p className="text-center text-sm text-rose-300">
        Link inválido. Peça um novo na tela de login.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Nova senha"
        className="campo"
      />
      <input
        type="password"
        value={repetir}
        onChange={(e) => setRepetir(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && salvar()}
        placeholder="Repita a nova senha"
        className="campo"
      />
      {erro && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {erro}
        </p>
      )}
      <button onClick={salvar} disabled={enviando} className="btn-primario mt-1 w-full !py-3">
        {enviando && <Loader2 size={16} className="animate-spin" />}
        Salvar nova senha
      </button>
    </div>
  );
}

export default function Redefinir() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-blue to-brand-violet">
            <KeyRound size={22} className="text-white" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-white">Nova senha</h1>
          <p className="mt-1 text-sm text-slate-500">Escolha uma senha para voltar a acessar.</p>
        </div>

        <div className="card p-6">
          <Suspense fallback={<p className="text-sm text-slate-500">Carregando...</p>}>
            <Formulario />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
