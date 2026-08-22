import { NextResponse } from "next/server";
import { exigirCliente } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { detectarSinais, nivelPrioridade } from "@/lib/sinais";
import { formatarExibicao } from "@/lib/planilha";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * ============================================================
 * LISTA QUENTE — QUEM JÁ ATENDEU, EM PLANILHA
 * ============================================================
 * Todo mundo que atendeu pelo menos uma ligação, uma linha por
 * telefone (a melhor conversa de cada um), com as etiquetas, a
 * prioridade e o resumo. É o banco de leads que já ouviram falar
 * da empresa — a matéria-prima da próxima campanha, já morna.
 *
 * Sai em CSV com ; (abre direto no Excel brasileiro).
 */

function celula(v) {
  const texto = String(v ?? "").replace(/\r?\n/g, " ").trim();
  return `"${texto.replace(/"/g, '""')}"`;
}

export async function GET() {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  await garantirTabelas();

  // Uma linha por telefone: a ligação mais longa (a melhor conversa)
  const { rows } = await sql`
    SELECT DISTINCT ON (l.telefone)
           l.telefone, l.nome, l.duracao_ms::int AS duracao_ms,
           l.transcript, l.resumo, l.criado_em,
           (SELECT COUNT(*)::int FROM ligacoes t
             WHERE t.cliente_id = l.cliente_id AND t.telefone = l.telefone AND t.sucesso) AS atendidas,
           EXISTS (
             SELECT 1 FROM mensagens_wa m
             WHERE m.cliente_id = l.cliente_id AND m.telefone = l.telefone AND m.direcao = 'in'
           ) AS respondeu_whatsapp,
           EXISTS (
             SELECT 1 FROM mensagens_wa m
             WHERE m.cliente_id = l.cliente_id AND m.telefone = l.telefone AND m.direcao = 'out'
           ) AS recebeu_whatsapp
    FROM ligacoes l
    WHERE l.cliente_id = ${cliente.id} AND l.sucesso = TRUE
    ORDER BY l.telefone, l.duracao_ms DESC
    LIMIT 5000;
  `;

  const cabecalho = [
    "nome", "telefone", "melhor_conversa_seg", "vezes_que_atendeu",
    "prioridade", "etiquetas", "recebeu_whatsapp", "respondeu_whatsapp",
    "ultima_ligacao", "resumo",
  ].join(";");

  const linhas = rows.map((r) => {
    const sinais = detectarSinais(r);
    const nivel = nivelPrioridade(sinais, r.duracao_ms);
    return [
      celula(r.nome),
      celula(formatarExibicao(r.telefone)),
      celula(Math.round((r.duracao_ms || 0) / 1000)),
      celula(r.atendidas),
      celula(nivel === "alta" ? "ALTA" : nivel === "baixa" ? "BAIXA" : ""),
      celula(sinais.map((x) => x.rotulo).join(", ")),
      celula(r.recebeu_whatsapp ? "sim" : "não"),
      celula(r.respondeu_whatsapp ? "sim" : "não"),
      celula(new Date(r.criado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })),
      celula(String(r.resumo ?? "").slice(0, 400)),
    ].join(";");
  });

  // BOM: sem ele o Excel brasileiro embaralha os acentos
  const csv = "\uFEFF" + [cabecalho, ...linhas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lista-quente.csv"',
    },
  });
}
