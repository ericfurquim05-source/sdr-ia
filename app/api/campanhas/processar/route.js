import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { clienteLogado } from "@/lib/auth";
import { preencherVagas, resumoFila, ultimosMotivos } from "@/lib/fila";
import { saldoAtual } from "@/lib/saldo";

export const maxDuration = 60;

/*
 * ============================================================
 * PROCESSADOR / CRON — REDE DE SEGURANÇA DA FILA
 * ============================================================
 * A fila anda sozinha pelo webhook. Esta rota cobre dois casos:
 *  1. Cron diário (vercel.json): religa filas que pararam por
 *     webhook perdido e destrava contatos presos em EM_LIGACAO.
 *  2. Cliente logado abrindo a rota: retoma a fila dele e
 *     devolve o placar da campanha + saldo.
 */
export async function GET() {
  if (!process.env.POSTGRES_URL) {
    return NextResponse.json({ erro: true, mensagem: "Banco não configurado." }, { status: 500 });
  }

  await garantirTabelas();

  // Destrava chamadas penduradas há mais de 15 min (webhook perdido)
  await sql`
    UPDATE contatos SET
      tentativas    = tentativas + 1,
      status        = CASE WHEN tentativas + 1 >= 7 THEN 'ESGOTADO' ELSE 'PENDENTE' END,
      ultimo_motivo = 'travada_em_ligacao (destravada automaticamente)',
      call_id       = NULL,
      proxima_tentativa = NOW() + make_interval(mins => 20),
      atualizado_em = NOW()
    WHERE status = 'EM_LIGACAO' AND atualizado_em < NOW() - INTERVAL '15 minutes';
  `;

  const cliente = await clienteLogado();

  // ---- Chamada manual pelo cliente logado ----
  if (cliente) {
    const resultado = await preencherVagas(cliente.id);
    return NextResponse.json({
      cliente: cliente.empresa || cliente.nome,
      saldo: await saldoAtual(cliente.id),
      fila: resultado,
      resumo: await resumoFila(cliente.id),
      // Mostra o retorno da Retell em cada tentativa — para diagnóstico
      ultimosErros: await ultimosMotivos(cliente.id),
      configuracao: {
        temApiKey: Boolean(process.env.RETELL_API_KEY),
        fromNumber: process.env.RETELL_FROM_NUMBER || null,
        prefixo: process.env.RETELL_PREFIXO_DISCAGEM || null,
        agenteFrio: process.env.RETELL_AGENT_FRIO_ID ? "configurado" : "FALTANDO",
        agenteQuente: process.env.RETELL_AGENT_QUENTE_ID ? "configurado" : "FALTANDO",
      },
    });
  }

  // ---- Cron: religa a fila de todos os clientes parados ----
  const { rows: clientes } = await sql`
    SELECT DISTINCT cliente_id FROM contatos WHERE status = 'PENDENTE';
  `;
  const religados = [];
  for (const { cliente_id } of clientes) {
    if ((await saldoAtual(cliente_id)) <= 0) continue; // sem saldo, não disca
    religados.push({ cliente_id, ...(await preencherVagas(cliente_id)) });
  }

  return NextResponse.json({ religados });
}
