import DashboardGraficos from "@/components/DashboardGraficos";
import AutoRetomada from "@/components/AutoRetomada";
import { clienteLogado } from "@/lib/auth";
import {
  kpisDoPeriodo, seriePorDia, desfechosDoPeriodo, hojeSP, dataValida,
} from "@/lib/estatisticas";

export const dynamic = "force-dynamic";

/*
 * DASHBOARD — dados reais, filtrados pelo período escolhido
 * (?de=YYYY-MM-DD&ate=YYYY-MM-DD). Sem parâmetros, mostra hoje.
 */
export default async function Dashboard({ searchParams }) {
  const hoje = hojeSP();
  let de = dataValida(searchParams?.de, hoje);
  let ate = dataValida(searchParams?.ate, hoje);
  if (de > ate) [de, ate] = [ate, de]; // usuário inverteu as datas

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
        kpisDoPeriodo(cliente.id, de, ate),
        seriePorDia(cliente.id, de, ate),
        desfechosDoPeriodo(cliente.id, de, ate),
      ]);
      dados = { kpis, serie, desfechos };
    }
  } catch {
    dados = vazio;
  }

  return (
    <>
      <AutoRetomada />
      <DashboardGraficos {...dados} de={de} ate={ate} />
    </>
  );
}
