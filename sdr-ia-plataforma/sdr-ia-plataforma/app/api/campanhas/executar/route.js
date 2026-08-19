import { NextResponse } from "next/server";
import { garantirTabela, sql } from "@/lib/db";
import { processarProximoDaFila } from "@/lib/fila";

export const maxDuration = 60;

/*
 * ============================================================
 * EXECUTAR CAMPANHA — IMPORTA A PLANILHA PARA A FILA
 * ============================================================
 * 1. Recebe os contatos já normalizados pelo navegador
 *    (DDD + número, sem o prefixo do tronco).
 * 2. Grava todos no banco com STATUS = 'PENDENTE'.
 * 3. Dispara a PRIMEIRA ligação. As seguintes são encadeadas
 *    pelo webhook: cada call_ended puxa o próximo da fila.
 *
 * Variáveis necessárias (Vercel → Environment Variables):
 *   RETELL_API_KEY, RETELL_AGENT_FRIO_ID, RETELL_AGENT_QUENTE_ID,
 *   RETELL_FROM_NUMBER, RETELL_PREFIXO_DISCAGEM, POSTGRES_URL
 */
export async function POST(request) {
  const { tipoAgente, contatos = [] } = await request.json();

  // ---- Modo demonstração: sem chave configurada, nada é disparado ----
  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json({
      simulado: true,
      total: contatos.length,
      mensagem: `${contatos.length} ligações entrariam na fila do agente de ligação ${tipoAgente}. Modo demonstração — configure RETELL_API_KEY na Vercel para disparar de verdade.`,
    });
  }

  if (!process.env.POSTGRES_URL) {
    return NextResponse.json(
      { erro: true, mensagem: "Banco de dados não configurado. Na Vercel, crie um Postgres em Storage e conecte ao projeto." },
      { status: 500 }
    );
  }

  if (!Array.isArray(contatos) || contatos.length === 0) {
    return NextResponse.json(
      { erro: true, mensagem: "Nenhum contato válido foi recebido da planilha." },
      { status: 400 }
    );
  }

  await garantirTabela();

  // ---- Importação para a fila (upsert por telefone) ----
  // Contato repetido volta para PENDENTE e zera as tentativas,
  // exceto se já foi CONCLUIDA (não liga de novo para quem atendeu).
  let importados = 0;
  for (const c of contatos) {
    await sql`
      INSERT INTO contatos (nome, telefone, agente, status)
      VALUES (${c.nome || ""}, ${c.telefone}, ${tipoAgente}, 'PENDENTE')
      ON CONFLICT (telefone) DO UPDATE SET
        nome   = EXCLUDED.nome,
        agente = EXCLUDED.agente,
        status = CASE WHEN contatos.status = 'CONCLUIDA' THEN 'CONCLUIDA' ELSE 'PENDENTE' END,
        tentativas = CASE WHEN contatos.status = 'CONCLUIDA' THEN contatos.tentativas ELSE 0 END,
        atualizado_em = NOW();
    `;
    importados++;
  }

  // ---- Dá o pontapé inicial na fila ----
  const primeira = await processarProximoDaFila();

  return NextResponse.json({
    simulado: false,
    total: importados,
    mensagem: primeira.disparou
      ? `${importados} contatos na fila. Primeira ligação discando agora — as demais seguem automaticamente, uma por vez.`
      : `${importados} contatos na fila. ${primeira.motivo === "ja_ha_ligacao_em_andamento" ? "Já existe uma ligação em andamento; a fila segue sozinha." : "Nada para discar no momento."}`,
  });
}
