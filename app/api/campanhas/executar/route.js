import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { exigirCliente } from "@/lib/auth";
import { podeIniciarCampanha } from "@/lib/saldo";
import { processarProximoDaFila } from "@/lib/fila";

export const maxDuration = 60;

/*
 * ============================================================
 * EXECUTAR CAMPANHA — IMPORTA A PLANILHA PARA A FILA
 * ============================================================
 * 1. Exige cliente logado (a campanha é sempre de alguém).
 * 2. BLOQUEIA na entrada se o saldo não cobrir a lista.
 * 3. Grava os contatos como PENDENTE e disca o primeiro.
 *    As ligações seguintes são encadeadas pelo webhook.
 */
export async function POST(request) {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: true, mensagem: "Faça login para executar campanhas." }, { status: 401 });
  }

  const { tipoAgente, contatos = [] } = await request.json();

  if (!Array.isArray(contatos) || contatos.length === 0) {
    return NextResponse.json(
      { erro: true, mensagem: "Nenhum contato válido foi recebido da planilha." },
      { status: 400 }
    );
  }

  // ---- Modo demonstração ----
  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json({
      simulado: true,
      total: contatos.length,
      mensagem: `${contatos.length} ligações entrariam na fila do agente de ligação ${tipoAgente}. Modo demonstração — configure RETELL_API_KEY na Vercel para disparar de verdade.`,
    });
  }

  // ---- Trava de saldo: bloqueia ANTES de aceitar a lista ----
  const checagem = await podeIniciarCampanha({
    clienteId: cliente.id,
    precoMinuto: cliente.preco_minuto,
    totalContatos: contatos.length,
  });

  if (!checagem.liberado) {
    const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return NextResponse.json(
      {
        erro: true,
        saldoInsuficiente: true,
        saldo: checagem.saldo,
        custoEstimado: checagem.custoEstimado,
        mensagem: `Saldo insuficiente para ${contatos.length} contatos. Estimativa: ${brl(checagem.custoEstimado)} · seu saldo: ${brl(checagem.saldo)}. Adicione ${brl(checagem.faltam)} na Carteira para liberar.`,
      },
      { status: 402 }
    );
  }

  await garantirTabelas();

  // ---- Importação para a fila (upsert por cliente + telefone) ----
  // Quem já atendeu (CONCLUIDA) não volta para a fila.
  let importados = 0;
  for (const c of contatos) {
    await sql`
      INSERT INTO contatos (cliente_id, nome, telefone, agente, status)
      VALUES (${cliente.id}, ${c.nome || ""}, ${c.telefone}, ${tipoAgente}, 'PENDENTE')
      ON CONFLICT (cliente_id, telefone) DO UPDATE SET
        nome       = EXCLUDED.nome,
        agente     = EXCLUDED.agente,
        status     = CASE WHEN contatos.status = 'CONCLUIDA' THEN 'CONCLUIDA' ELSE 'PENDENTE' END,
        tentativas = CASE WHEN contatos.status = 'CONCLUIDA' THEN contatos.tentativas ELSE 0 END,
        atualizado_em = NOW();
    `;
    importados++;
  }

  // ---- Pontapé inicial: a fila segue sozinha pelo webhook ----
  const primeira = await processarProximoDaFila(cliente.id);

  return NextResponse.json({
    simulado: false,
    total: importados,
    saldo: checagem.saldo,
    custoEstimado: checagem.custoEstimado,
    mensagem: primeira.disparou
      ? `${importados} contatos na fila. Primeira ligação discando agora — as demais seguem automaticamente, uma por vez.`
      : `${importados} contatos na fila. A discagem segue automaticamente.`,
  });
}
