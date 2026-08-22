import { NextResponse } from "next/server";
import { exigirCliente } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/*
 * ============================================================
 * RELATÓRIO DE OPERADORA — DO QUE OS 18% SÃO FEITOS
 * ============================================================
 * "Erro de operadora" é um balaio: número que não existe mais,
 * tronco SIP congestionado, rota bloqueada. O tratamento de cada
 * um é diferente — número morto é qualidade da lista (aceita e
 * segue), congestionamento é briga com o fornecedor do SIP.
 *
 * Este CSV agrupa os erros pelo motivo bruto que a operadora
 * devolveu, com quantidade, exemplo e tradução. É o anexo pronto
 * para mandar ao fornecedor do tronco quando a fatia técnica
 * estiver alta.
 */

function celula(v) {
  const texto = String(v ?? "").replace(/\r?\n/g, " ").trim();
  return `"${texto.replace(/"/g, '""')}"`;
}

/** Tradução das famílias de erro para linguagem de gente. */
function traduzir(motivo) {
  const m = String(motivo || "").toLowerCase();
  if (/invalid_destination/.test(m))
    return "Número inválido ou inexistente (qualidade da lista)";
  if (/dial_failed/.test(m))
    return "Operadora recusou a chamada (rota/congestionamento — cobrar o fornecedor SIP)";
  if (/permission_denied|no_valid_payment/.test(m))
    return "Problema de conta/permissão no tronco (cobrar o fornecedor SIP)";
  if (/http 4/.test(m)) return "Rejeição na API de discagem (formato do número ou configuração)";
  if (/erro_rede/.test(m)) return "Falha de rede momentânea";
  return "Outro erro técnico";
}

export async function GET(request) {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  await garantirTabelas();

  const dias = Math.min(Number(new URL(request.url).searchParams.get("dias")) || 30, 90);

  // Mesma régua da classificação do Dashboard: erro técnico gravado
  // no motivo da ligação, dentro do período pedido.
  const { rows } = await sql`
    SELECT motivo, COUNT(*)::int AS quantidade,
           MAX(criado_em) AS ultima,
           (ARRAY_AGG(telefone ORDER BY criado_em DESC))[1] AS exemplo_telefone
    FROM ligacoes
    WHERE cliente_id = ${cliente.id}
      AND criado_em > NOW() - (${dias} * INTERVAL '1 day')
      AND sucesso = FALSE
      AND motivo ~* 'invalid_destination|telephony|dial_failed|error|http'
    GROUP BY motivo
    ORDER BY quantidade DESC
    LIMIT 200;
  `;

  const total = rows.reduce((soma, r) => soma + r.quantidade, 0);

  const cabecalho = ["diagnostico", "quantidade", "percentual", "ultima_ocorrencia", "exemplo_telefone", "erro_bruto"].join(";");
  const linhas = rows.map((r) =>
    [
      celula(traduzir(r.motivo)),
      celula(r.quantidade),
      celula(total ? Math.round((r.quantidade / total) * 100) + "%" : "0%"),
      celula(new Date(r.ultima).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })),
      celula(r.exemplo_telefone),
      celula(String(r.motivo ?? "").slice(0, 200)),
    ].join(";")
  );

  const csv = "\uFEFF" + [cabecalho, ...linhas].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-operadora-${dias}d.csv"`,
    },
  });
}
