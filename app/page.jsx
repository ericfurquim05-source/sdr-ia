import DashboardGraficos from "@/components/DashboardGraficos";
import AutoRetomada from "@/components/AutoRetomada";
import PrimeirosPassos from "@/components/PrimeirosPassos";
import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import {
  kpisDoPeriodo, desfechosDoPeriodo, hojeSP, lerJanela,
} from "@/lib/estatisticas";

export const dynamic = "force-dynamic";

/** O que o cliente já fez, para o guia de primeiros passos. */
async function progressoDoCliente(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT
      COALESCE((SELECT SUM(valor) FROM lancamentos WHERE cliente_id = ${clienteId}), 0)::float > 0 AS tem_saldo,
      EXISTS (SELECT 1 FROM contatos WHERE cliente_id = ${clienteId})  AS tem_contatos,
      EXISTS (SELECT 1 FROM ligacoes WHERE cliente_id = ${clienteId})  AS tem_ligacoes,
      EXISTS (SELECT 1 FROM eventos  WHERE cliente_id = ${clienteId})  AS tem_reunioes;
  `;
  return {
    temSaldo: rows[0]?.tem_saldo ?? false,
    temContatos: rows[0]?.tem_contatos ?? false,
    temLigacoes: rows[0]?.tem_ligacoes ?? false,
    temReunioes: rows[0]?.tem_reunioes ?? false,
  };
}

/** Últimas 5 ligações, para o painel ao vivo já abrir preenchido. */
async function ultimasLigacoes(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT id, nome, telefone, duracao_ms::int AS duracao_ms,
           sucesso, recording_url, criado_em
    FROM ligacoes WHERE cliente_id = ${clienteId}
    ORDER BY criado_em DESC LIMIT 5;
  `;
  return rows;
}

/*
 * DASHBOARD — dados reais, filtrados pelo período escolhido
 * (?de=YYYY-MM-DD&ate=YYYY-MM-DD). Sem parâmetros, mostra hoje.
 */
export default async function Dashboard({ searchParams }) {
  const hoje = hojeSP();
  const { de, ate, horas } = lerJanela(searchParams, hoje, hoje);

  const vazio = {
    kpis: {
      total: 0, atendidas: 0, nao_atendidas: 0, custo: 0, contatos_unicos: 0,
      minutosFalados: 0, duracaoMediaSeg: 0, taxaAtendimento: 0,
      reunioes: 0, conversao: 0, custoPorReuniao: null, whatsapps: 0,
      fila: { pendentes: 0, em_ligacao: 0, concluidas: 0, esgotados: 0 },
    },
    desfechos: [],
  };

  let dados = vazio;
  let aoVivo = { emLigacao: 0, ultimas: [] };
  let progresso = null;
  try {
    const cliente = await clienteLogado();
    if (cliente) {
      const [kpis, desfechos] = await Promise.all([
        kpisDoPeriodo(cliente.id, de, ate, horas),
        desfechosDoPeriodo(cliente.id, de, ate, horas),
      ]);
      dados = { kpis, desfechos };
      progresso = await progressoDoCliente(cliente.id);
      aoVivo = {
        emLigacao: kpis.fila.em_ligacao,
        ultimas: (await ultimasLigacoes(cliente.id)).map((l) => ({
          ...l,
          criado_em: l.criado_em.toISOString(),
        })),
      };
    }
  } catch {
    dados = vazio;
  }

  return (
    <>
      <AutoRetomada />
      {progresso && <PrimeirosPassos progresso={progresso} />}
      <DashboardGraficos {...dados} de={de} ate={ate} horas={horas} aoVivo={aoVivo} />
    </>
  );
}
