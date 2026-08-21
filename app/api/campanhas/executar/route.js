import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { exigirCliente } from "@/lib/auth";
import { podeIniciarCampanha } from "@/lib/saldo";
import { preencherVagas } from "@/lib/fila";

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
  try {
    return await executarCampanha(request);
  } catch (e) {
    return NextResponse.json(
      { erro: true, mensagem: `Falha inesperada: ${String(e?.message || e).slice(0, 300)}` },
      { status: 500 }
    );
  }
}

async function executarCampanha(request) {
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

  // Teto por BLOCO (não por lista): o navegador fatia listas grandes
  // e envia em partes, então não há limite de tamanho total.
  const LIMITE_POR_BLOCO = 3000;
  if (contatos.length > LIMITE_POR_BLOCO) {
    return NextResponse.json(
      {
        erro: true,
        mensagem: `Bloco muito grande (${contatos.length}). O envio deve ser feito em partes de até ${LIMITE_POR_BLOCO}.`,
      },
      { status: 413 }
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

  // ---- Trava de saldo: avaliada no bloco que inicia a discagem ----
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

  // ---- Importação para a fila, EM LOTE ----
  // Inserir um a um derrubaria a rota por timeout em listas grandes
  // (5.000 contatos = 5.000 idas ao banco). Aqui vão até 500 por
  // consulta, usando UNNEST — poucas idas, sempre parametrizado.
  // Quem já atendeu (CONCLUIDA) não volta para a fila.
  const TAMANHO_LOTE = 500;
  let importados = 0;

  for (let i = 0; i < contatos.length; i += TAMANHO_LOTE) {
    const lote = contatos.slice(i, i + TAMANHO_LOTE);
    const nomes = lote.map((c) => String(c.nome || "").slice(0, 120));
    const telefones = lote.map((c) => String(c.telefone));

    await sql`
      INSERT INTO contatos (cliente_id, nome, telefone, agente, status)
      SELECT ${cliente.id}, x.nome, x.telefone, ${tipoAgente}, 'PENDENTE'
      FROM UNNEST(${nomes}::text[], ${telefones}::text[]) AS x(nome, telefone)
      ON CONFLICT (cliente_id, telefone) DO UPDATE SET
        nome       = EXCLUDED.nome,
        agente     = EXCLUDED.agente,
        status     = CASE WHEN contatos.status = 'CONCLUIDA' THEN 'CONCLUIDA' ELSE 'PENDENTE' END,
        tentativas = CASE WHEN contatos.status = 'CONCLUIDA' THEN contatos.tentativas ELSE 0 END,
        atualizado_em = NOW();
    `;
    importados += lote.length;
  }

  // ---- Blocos intermediários: só gravam e devolvem ----
  if (!iniciarDiscagem) {
    return NextResponse.json({ ok: true, parcial: true, total: importados });
  }

  // ---- Último bloco: abre todas as vagas simultâneas ----
  const inicio = await preencherVagas(cliente.id);

  return NextResponse.json({
    simulado: false,
    total: importados,
    saldo: checagem.saldo,
    custoEstimado: checagem.custoEstimado,
    mensagem: inicio.emitidas > 0
      ? `${importados} contatos na fila. ${inicio.emitidas} ${inicio.emitidas === 1 ? "ligação discando" : "ligações discando"} agora — conforme cada uma termina, a próxima entra automaticamente (até ${inicio.concorrencia} em paralelo).`
      : inicio.detalhes?.[0]?.motivo === "fora_do_horario"
        ? `${importados} contatos na fila. Fora do horário de ligações (${inicio.detalhes[0].janela}) — a discagem começa automaticamente no próximo horário permitido.`
        : `${importados} contatos na fila. A discagem segue automaticamente.`,
  });
}
