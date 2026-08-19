import { NextResponse } from "next/server";

export const maxDuration = 60;

/*
 * ============================================================
 * AQUI ENTRA O DISPARO DE CAMPANHA NA RETELL AI
 * ============================================================
 * O botão "Executar campanha" chama esta rota. Ela escolhe o
 * agente (ligação fria ou quente) e cria uma chamada telefônica
 * para cada contato da planilha, via API REST da Retell.
 *
 * Variáveis necessárias (.env.local / Vercel):
 *   RETELL_API_KEY, RETELL_AGENT_FRIO_ID,
 *   RETELL_AGENT_QUENTE_ID, RETELL_FROM_NUMBER
 */
export async function POST(request) {
  const { tipoAgente, contatos = [] } = await request.json();

  const agentId =
    tipoAgente === "quente"
      ? process.env.RETELL_AGENT_QUENTE_ID
      : process.env.RETELL_AGENT_FRIO_ID;

  // ---- Modo demonstração: sem chave configurada, nada é disparado ----
  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json({
      simulado: true,
      total: contatos.length,
      mensagem: `${contatos.length} ligações entrariam na fila do agente de ligação ${tipoAgente}. Modo demonstração — configure RETELL_API_KEY na Vercel para disparar de verdade.`,
    });
  }

  // ---- Validação das configurações ----
  if (!agentId) {
    return NextResponse.json(
      {
        erro: true,
        mensagem: `O ID do agente de ligação ${tipoAgente} não está configurado. Preencha RETELL_AGENT_${tipoAgente === "quente" ? "QUENTE" : "FRIO"}_ID na Vercel.`,
      },
      { status: 400 }
    );
  }

  if (!process.env.RETELL_FROM_NUMBER) {
    return NextResponse.json(
      { erro: true, mensagem: "O número de origem não está configurado. Preencha RETELL_FROM_NUMBER na Vercel." },
      { status: 400 }
    );
  }

  if (!Array.isArray(contatos) || contatos.length === 0) {
    return NextResponse.json(
      { erro: true, mensagem: "Nenhum contato válido foi recebido da planilha." },
      { status: 400 }
    );
  }

  // ---- Disparo das ligações ----
  let sucessos = 0;
  const falhas = [];

  for (const contato of contatos) {
    try {
      const resposta = await fetch("https://api.retellai.com/v2/create-phone-call", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_number: process.env.RETELL_FROM_NUMBER,
          to_number: contato.telefone, // já vem em E.164, ex.: +5511984567712
          override_agent_id: agentId,
          // Variáveis disponíveis dentro do prompt do agente, ex.: {{nome}}
          retell_llm_dynamic_variables: {
            nome: contato.nome || "",
          },
        }),
      });

      if (resposta.ok) {
        sucessos++;
      } else {
        const detalhe = await resposta.text();
        falhas.push({ telefone: contato.telefone, detalhe: detalhe.slice(0, 200) });
      }
    } catch (e) {
      falhas.push({ telefone: contato.telefone, detalhe: String(e).slice(0, 200) });
    }
  }

  if (sucessos === 0) {
    return NextResponse.json(
      {
        erro: true,
        mensagem: `Nenhuma ligação foi criada. Retorno da Retell: ${falhas[0]?.detalhe ?? "erro desconhecido"}`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    simulado: false,
    total: sucessos,
    falhas: falhas.length,
    mensagem:
      falhas.length === 0
        ? `${sucessos} ligações criadas na Retell AI com o agente de ligação ${tipoAgente}.`
        : `${sucessos} ligações criadas e ${falhas.length} falharam. Confira se os números estão no formato +55DDNNNNNNNNN.`,
  });
}
