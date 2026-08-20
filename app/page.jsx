import DashboardGraficos from "@/components/DashboardGraficos";
import AutoRetomada from "@/components/AutoRetomada";
import { clienteLogado } from "@/lib/auth";
import {
  kpisDoPeriodo, seriePorDia, desfechosDoPeriodo, hojeSP, lerJanela,
} from "@/lib/estatisticas";

export const dynamic = "force-dynamic";

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
    serie: [],
    desfechos: [],
  };

  let dados = vazio;
  try {
    const cliente = await clienteLogado();
    if (cliente) {
      const [kpis, serie, desfechos] = await Promise.all([
        kpisDoPeriodo(cliente.id, de, ate, horas),
        seriePorDia(cliente.id, de, ate, horas),
        desfechosDoPeriodo(cliente.id, de, ate, horas),
      ]);
      dados = { kpis, serie, desfechos };
    }
  } catch {
    dados = vazio;
  }

  return (
    <>
      <AutoRetomada />
      <DashboardGraficos {...dados} de={de} ate={ate} horas={horas} />
    </>
  );
}
