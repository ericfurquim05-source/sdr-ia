import { NextResponse } from "next/server";

/*
 * ============================================================
 * AQUI ENTRA O DISPARO DE CAMPANHA NA RETELL AI
 * ============================================================
 * O botão "Executar campanha" chama esta rota. Ela seleciona o
 * agente (ligação fria ou quente) e cria uma chamada telefônica
 * para cada contato via API REST da Retell.
 *
 * Variáveis necessárias (.env.local / Vercel):
 *   RETELL_API_KEY, RETELL_AGENT_FRIO_ID,
 *   RETELL_AGENT_QUENTE_ID, RETELL_FROM_NUMBER
 */
export async function POST(request) {
  const { tipoAgente, contatos = [], totalContatos = 0 } = await request.json();

  const agentId =
    tipoAgente === "quente"
      ? process.env.RETELL_AGENT_QUENTE_ID
      : process.env.RETELL_AGENT_FRIO_ID;

  // Sem chave configurada, a plataforma roda em modo demonstração
  if (!process.env.RETELL_API_KEY) {
    const total = contatos.length || totalContatos;
    return NextResponse.json({
      simulado: true,
      total,
      mensagem: `${total} ligações entrariam na fila do agente de ligação ${tipoAgente}. Modo demonstração — configure RETELL_API_KEY para disparar de verdade.`,
    });
  }

  // TODO em produção: fazer o parse completo do CSV/Excel no backend
  // (upload via FormData) em vez de receber só a contagem do frontend.
  const resultados = [];

  for (const contato of contatos) {
    const resposta = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_number: process.env.RETELL_FROM_NUMBER,
        to_number: contato.telefone, // formato E.164, ex.: +5511984567712
        override_agent_id: agentId,
        // Variáveis dinâmicas disponíveis no prompt do agente Retell:
        retell_llm_dynamic_variables: {
          nome: contato.nome ?? "",
        },
      }),
    });

    resultados.push(await resposta.json());
  }

  return NextResponse.json({
    simulado: false,
    total: resultados.length,
    mensagem: `${resultados.length} ligações criadas na Retell AI.`,
  });
}
