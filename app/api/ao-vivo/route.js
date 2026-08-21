import { NextResponse } from "next/server";
import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/*
 * Alimenta o painel ao vivo do Dashboard: quantas ligações estão
 * em curso agora e as últimas encerradas, com gravação.
 * Chamado a cada 15 segundos pela tela.
 */
export async function GET() {
  try {
    const cliente = await clienteLogado();
    if (!cliente) return NextResponse.json({ emLigacao: 0, ultimas: [] });

    await garantirTabelas();

    const { rows: ativas } = await sql`
      SELECT COUNT(*)::int AS total FROM contatos
      WHERE cliente_id = ${cliente.id} AND status = 'EM_LIGACAO';
    `;

    const { rows: ultimas } = await sql`
      SELECT id, nome, telefone, duracao_ms::int AS duracao_ms,
             sucesso, recording_url, criado_em
      FROM ligacoes
      WHERE cliente_id = ${cliente.id}
      ORDER BY criado_em DESC
      LIMIT 5;
    `;

    return NextResponse.json({
      emLigacao: ativas[0]?.total ?? 0,
      ultimas: ultimas.map((l) => ({ ...l, criado_em: l.criado_em.toISOString() })),
    });
  } catch {
    return NextResponse.json({ emLigacao: 0, ultimas: [] });
  }
}
