import { sql } from "@vercel/postgres";

/*
 * ============================================================
 * BANCO DE DADOS — SCHEMA MULTI-CLIENTE
 * ============================================================
 * Toda tabela de dados carrega cliente_id: é o que garante que
 * um cliente nunca enxergue a fila, o saldo ou as conversas do
 * outro. Essa é a fundação do SaaS — mudar depois seria refazer.
 *
 * TABELAS
 *   clientes    → conta de acesso (login/senha) e dados da empresa
 *   agentes     → agentes da Retell que pertencem a cada cliente
 *   contatos    → fila de ligações da campanha
 *   lancamentos → EXTRATO financeiro (fonte da verdade do saldo)
 *   conversas   → janelas de 24h do WhatsApp (cobrança por janela)
 *
 * SOBRE O SALDO
 * O saldo NÃO é um campo que se soma e subtrai. Ele é a SOMA dos
 * lançamentos. Assim nada se perde numa falha no meio da operação
 * e todo centavo é auditável — dá para provar de onde veio cada
 * débito. Recargas entram positivas, consumos negativos.
 */

let tabelasProntas = false;

export async function garantirTabelas() {
  if (tabelasProntas) return;

  // ---- Clientes (contas de acesso) ----
  await sql`
    CREATE TABLE IF NOT EXISTS clientes (
      id             SERIAL PRIMARY KEY,
      nome           TEXT NOT NULL,
      empresa        TEXT NOT NULL DEFAULT '',
      email          TEXT NOT NULL,
      senha_hash     TEXT NOT NULL,
      preco_minuto   NUMERIC(10,4) NOT NULL DEFAULT 1.50,  -- R$ por minuto falado
      preco_conversa NUMERIC(10,4) NOT NULL DEFAULT 0.50,  -- R$ por janela de WhatsApp
      ativo          BOOLEAN NOT NULL DEFAULT TRUE,
      criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS clientes_email_unico ON clientes (LOWER(email));`;

  // ---- Agentes da Retell por cliente ----
  await sql`
    CREATE TABLE IF NOT EXISTS agentes (
      id              SERIAL PRIMARY KEY,
      cliente_id      INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      tipo            TEXT NOT NULL,            -- fria | quente
      nome            TEXT NOT NULL DEFAULT '',
      retell_agent_id TEXT NOT NULL,
      from_number     TEXT,                     -- número de origem próprio (opcional)
      criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS agentes_cliente_tipo ON agentes (cliente_id, tipo);`;

  // ---- Fila de ligações ----
  await sql`
    CREATE TABLE IF NOT EXISTS contatos (
      id            SERIAL PRIMARY KEY,
      cliente_id    INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      nome          TEXT NOT NULL DEFAULT '',
      telefone      TEXT NOT NULL,            -- local: DDD + numero (ex.: 51980554326)
      tentativas    INT  NOT NULL DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'PENDENTE',
      agente        TEXT NOT NULL DEFAULT 'fria',
      call_id       TEXT,
      ultimo_motivo TEXT,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  // O mesmo telefone pode existir para clientes diferentes
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS contatos_cliente_telefone ON contatos (cliente_id, telefone);`;
  await sql`CREATE INDEX IF NOT EXISTS contatos_fila ON contatos (cliente_id, status, tentativas);`;

  // ---- Extrato financeiro (fonte da verdade do saldo) ----
  await sql`
    CREATE TABLE IF NOT EXISTS lancamentos (
      id          SERIAL PRIMARY KEY,
      cliente_id  INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      tipo        TEXT NOT NULL,              -- recarga | ligacao | whatsapp | ajuste
      valor       NUMERIC(12,4) NOT NULL,     -- positivo credita, negativo debita
      descricao   TEXT NOT NULL DEFAULT '',
      referencia  TEXT,                       -- call_id, id da conversa, id do pagamento
      criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS lancamentos_cliente ON lancamentos (cliente_id, criado_em DESC);`;
  // Trava anti-cobrança-dupla: o mesmo call_id nunca é debitado duas vezes
  // (a Retell pode reenviar o mesmo webhook).
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS lancamentos_referencia_unica
    ON lancamentos (tipo, referencia) WHERE referencia IS NOT NULL;
  `;

  // ---- Janelas de conversa do WhatsApp ----
  await sql`
    CREATE TABLE IF NOT EXISTS conversas (
      id            SERIAL PRIMARY KEY,
      cliente_id    INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      telefone      TEXT NOT NULL,
      janela_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      janela_fim    TIMESTAMPTZ NOT NULL,     -- início + 24h
      cobrada       BOOLEAN NOT NULL DEFAULT FALSE
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS conversas_janela ON conversas (cliente_id, telefone, janela_fim DESC);`;

  tabelasProntas = true;
}

// Mantém compatibilidade com o nome antigo
export const garantirTabela = garantirTabelas;

export { sql };
