import CarteiraCliente from "@/components/CarteiraCliente";
import { clienteLogado } from "@/lib/auth";
import { saldoAtual, extrato } from "@/lib/saldo";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Carteira — saldo, extrato e consumo REAIS do banco. */
export default async function Carteira() {
  let dados = { saldo: 0, precoMinuto: 1.5, consumoMes: 0, extrato: [] };

  try {
    const cliente = await clienteLogado();
    if (cliente) {
      await garantirTabelas();
      const [saldo, movimentos, consumo] = await Promise.all([
        saldoAtual(cliente.id),
        extrato(cliente.id, 50),
        sql`
          SELECT COALESCE(ABS(SUM(valor)), 0)::float AS consumo
          FROM lancamentos
          WHERE cliente_id = ${cliente.id} AND valor < 0
            AND date_trunc('month', criado_em AT TIME ZONE 'America/Sao_Paulo')
              = date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo');
        `,
      ]);
      dados = {
        saldo,
        precoMinuto: Number(cliente.preco_minuto),
        consumoMes: consumo.rows[0].consumo,
        extrato: movimentos.map((m) => ({ ...m, criado_em: m.criado_em.toISOString() })),
      };
    }
  } catch {
    // sem banco: tela abre zerada
  }

  return (
    <CarteiraCliente
      saldo={dados.saldo}
      precoMinuto={dados.precoMinuto}
      consumoMes={dados.consumoMes}
      extrato={dados.extrato}
    />
  );
}
