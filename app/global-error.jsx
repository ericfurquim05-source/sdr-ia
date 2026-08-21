"use client";

/*
 * Rede de segurança para erros que acontecem no próprio layout.
 * Precisa renderizar html e body por conta própria.
 */
export default function ErroGlobal({ error, reset }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          background: "#060A14",
          color: "#E6ECF7",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 560, textAlign: "center" }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            Erro ao carregar a aplicação
          </h2>
          <pre
            style={{
              background: "#0A1220",
              border: "1px solid rgba(244,63,94,.25)",
              borderRadius: 12,
              padding: 16,
              textAlign: "left",
              fontSize: 12,
              color: "#FDA4AF",
              overflowX: "auto",
            }}
          >
            {error?.message || "Erro sem mensagem"}
            {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg,#3E7BFA,#8B5CF6)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
