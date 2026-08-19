import { NextResponse } from "next/server";
import { garantirTabelas, sql } from "@/lib/db";
import { exigirCliente } from "@/lib/auth";

/*
 * Zera as tentativas da fila do cliente e devolve todos os
 * contatos para PENDENTE. Útil durante os testes: depois de
 * corrigir uma configuração, dá para tentar de novo sem
 * precisar subir a planilha outra vez.
 *
 * Abra no navegador: /api/campanhas/reiniciar
 */
export async function GET() {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  await garantirTabelas();
  const { rows } = await sql`
    UPDATE contatos SET
      tentativas = 0, status = 'PENDENTE', ultimo_motivo = NULL,
      call_id = NULL, proxima_tentativa = NOW(), atualizado_em = NOW()
    WHERE cliente_id = ${cliente.id} AND status <> 'CONCLUIDA'
    RETURNING id;
  `;

  return NextResponse.json({
    reiniciados: rows.length,
    mensagem: `${rows.length} contatos voltaram para PENDENTE. Abra /api/campanhas/processar para discar de novo.`,
  });
}
