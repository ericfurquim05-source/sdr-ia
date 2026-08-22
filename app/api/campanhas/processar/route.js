import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { clienteLogado } from "@/lib/auth";
import { preencherVagas, resumoFila, ultimosMotivos } from "@/lib/fila";
import { processarLembretes } from "@/lib/lembretes";
import { saldoAtual } from "@/lib/saldo";

export const maxDuration = 60;

/*
 * ============================================================
 * PROCESSADOR / CRON — REDE DE SEGURANÇA E DIAGNÓSTICO
 * ============================================================
 * A fila anda sozinha pelo webhook. Esta rota cobre dois casos:
 *  1. Cron diário (vercel.json): religa filas paradas por webhook
 *     perdido e destrava contatos presos em EM_LIGACAO.
 *  2. Cliente logado: retoma a fila e devolve o placar da campanha,
 *     o saldo e — o mais útil — o retorno cru da Retell em
 *     "ultimosErros", que explica por que uma ligação não completou.
 *
 * Nada aqui pode devolver tela de erro 500 em branco: qualquer
 * exceção volta como JSON legível, senão fica impossível depurar.
 */
export async function GET(request) {
  try {
    // Quem pode acionar a fila:
    //  - o cliente logado (retoma a própria campanha)
    //  - o cron da Vercel, que envia o CRON_SECRET no cabeçalho
    // Sem isso, qualquer pessoa com a URL faria o sistema discar.
    const segredo = process.env.CRON_SECRET;
    const autorizacao = request.headers.get("authorization") || "";
    const ehCron = Boolean(segredo) && autorizacao === `Bearer ${segredo}`;

    if (!process.env.POSTGRES_URL) {
      return NextResponse.json(
        { erro: true, mensagem: "Banco não configurado. Crie um Postgres em Storage e conecte ao projeto." },
        { status: 500 }
      );
    }

    await garantirTabelas();
    // Lembretes de reunião pegam carona em toda passada da fila
    await processarLembretes().catch((e) => console.error("lembretes:", e));

    // Destrava chamadas penduradas há mais de 15 min (webhook perdido)
    await sql`
      UPDATE contatos SET
        tentativas    = tentativas + 1,
        status        = CASE WHEN tentativas + 1 >= 7 THEN 'ESGOTADO' ELSE 'PENDENTE' END,
        ultimo_motivo = 'travada_em_ligacao (destravada automaticamente)',
        call_id       = NULL,
        proxima_tentativa = NOW() + INTERVAL '20 minutes',
        atualizado_em = NOW()
      WHERE status = 'EM_LIGACAO' AND atualizado_em < NOW() - INTERVAL '15 minutes';
    `;

    const cliente = await clienteLogado();

    // ---- Cliente logado: retoma a fila e mostra o diagnóstico ----
    if (cliente) {
      const resultado = await preencherVagas(cliente.id);
      return NextResponse.json({
        cliente: cliente.empresa || cliente.nome,
        saldo: await saldoAtual(cliente.id),
        fila: resultado,
        resumo: await resumoFila(cliente.id),
        // Retorno cru da Retell em cada tentativa
        ultimosErros: await ultimosMotivos(cliente.id),
        configuracao: {
          temApiKey: Boolean(process.env.RETELL_API_KEY),
          fromNumber: process.env.RETELL_FROM_NUMBER || null,
          prefixo: process.env.RETELL_PREFIXO_DISCAGEM || null,
          agenteFrio: process.env.RETELL_AGENT_FRIO_ID ? "configurado" : "FALTANDO",
          agenteQuente: process.env.RETELL_AGENT_QUENTE_ID ? "configurado" : "FALTANDO",
          concorrencia: Number(process.env.CONCORRENCIA_MAXIMA || 3),
          minutosEntreTentativas: Number(process.env.MINUTOS_ENTRE_TENTATIVAS || 20),
        },
      });
    }

    // ---- Cron: religa a fila de todos os clientes com saldo ----
    const { rows: clientes } = await sql`
      SELECT DISTINCT cliente_id FROM contatos WHERE status = 'PENDENTE';
    `;
    const religados = [];
    for (const { cliente_id } of clientes) {
      if ((await saldoAtual(cliente_id)) <= 0) continue;
      religados.push({ cliente_id, ...(await preencherVagas(cliente_id)) });
    }

    return NextResponse.json({ religados });
  } catch (e) {
    // Erro legível em vez de tela em branco
    return NextResponse.json(
      {
        erro: true,
        mensagem: String(e?.message || e).slice(0, 500),
        dica: "Erro no servidor. Se citar uma coluna ou função do banco, o schema precisa de ajuste.",
      },
      { status: 500 }
    );
  }
}
