import DashboardGraficos from "@/components/DashboardGraficos";
import AutoRetomada from "@/components/AutoRetomada";
import { clienteLogado } from "@/lib/auth";
import { kpisDeHoje, serieUltimos7Dias, desfechosDeHoje } from "@/lib/estatisticas";

// Sempre buscar os números mais novos a cada visita
export const dynamic = "force-dynamic";

/*
 * DASHBOARD — 100% DADOS REAIS
 * Os números vêm da tabela "ligacoes" (uma linha por chamada,
 * gravada pelo webhook da Retell) e da fila "contatos".
 * Nada aqui é dado de exemplo.
 */
export default async function Dashboard() {
  const vazio = {
    kpis: {
      total: 0,
      atendidas: 0,
      nao_atendidas: 0,
      custo: 0,
      minutosFalados: 0,
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
        kpisDeHoje(cliente.id),
        serieUltimos7Dias(cliente.id),
        desfechosDeHoje(cliente.id),
      ]);
      dados = { kpis, serie, desfechos };
    }
  } catch {
    // Sem banco configurado (ambiente de demonstração), mostra zeros
    dados = vazio;
  }

  return (
    <>
      <AutoRetomada />
      <DashboardGraficos kpis={dados.kpis} serie={dados.serie} desfechos={dados.desfechos} />
    </>
  );
}
