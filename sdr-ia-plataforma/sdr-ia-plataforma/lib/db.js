import { sql } from "@vercel/postgres";

/*
 * ============================================================
 * BANCO DE DADOS — FILA DE LIGAÇÕES
 * ============================================================
 * Tabela "contatos": fila da campanha com controle de status.
 *
 * STATUS possíveis:
 *   PENDENTE   → aguardando ligação (entra na fila)
 *   EM_LIGACAO → chamada em andamento na Retell
 *   CONCLUIDA  → cliente atendeu E a conversa durou > 13s
 *   ESGOTADO   → falhou 7 vezes (não liga mais)
 *
 * Requer um banco Postgres criado na Vercel (Storage → Postgres).
 * A variável POSTGRES_URL é injetada automaticamente.
 */

let tabelaPronta = false;

export async function garantirTabela() {
  if (tabelaPronta) return;
  await sql`
    CREATE TABLE IF NOT EXISTS contatos (
      id            SERIAL PRIMARY KEY,
      nome          TEXT NOT NULL DEFAULT '',
      telefone      TEXT NOT NULL,            -- local: DDD + numero (ex.: 51980554326)
      tentativas    INT  NOT NULL DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'PENDENTE',
      agente        TEXT NOT NULL DEFAULT 'fria',   -- fria | quente
      call_id       TEXT,                     -- id da chamada atual na Retell
      ultimo_motivo TEXT,                     -- disconnection_reason da última tentativa
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS contatos_telefone_unico ON contatos (telefone);`;
  await sql`CREATE INDEX IF NOT EXISTS contatos_fila ON contatos (status, tentativas);`;
  tabelaPronta = true;
}

export { sql };
