import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * ============================================================
 * AGENTES DO CLIENTE
 * ============================================================
 * Quem monta o agente é VOCÊ, no console — não o cliente.
 * O modelo do negócio é serviço: você entende o que o cliente
 * precisa, escreve o roteiro e entrega pronto. Ele só sobe a
 * lista e dispara.
 *
 * A telefonia continua nossa: as ligações saem pelo tronco
 * configurado, ou pelo número próprio do cliente, quando houver.
 */

async function chamarRetell(caminho, corpo, metodo = "POST") {
  const r = await fetch(`https://api.retellai.com${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados = {};
  try {
    dados = JSON.parse(texto);
  } catch {
    dados = { bruto: texto };
  }
  return { ok: r.ok, dados, status: r.status };
}

export async function POST(request) {
  try {
    await exigirAdmin();
  } catch {
    return NextResponse.json({ erro: "Acesso restrito ao console." }, { status: 403 });
  }

  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json({ erro: "Telefonia não configurada." }, { status: 500 });
  }

  try {
    const { clienteId, tipo, nome, prompt, voz, saudacao } = await request.json();

    if (!clienteId) {
      return NextResponse.json({ erro: "Escolha o cliente." }, { status: 400 });
    }

    if (!prompt || prompt.trim().length < 50) {
      return NextResponse.json(
        { erro: "Escreva um roteiro com pelo menos algumas linhas." },
        { status: 400 }
      );
    }

    await garantirTabelas();
    const tipoFinal = tipo === "quente" ? "quente" : "fria";

    // Já existe agente deste tipo para este cliente?
    const { rows: existente } = await sql`
      SELECT retell_agent_id, llm_id FROM agentes
      WHERE cliente_id = ${clienteId} AND tipo = ${tipoFinal} LIMIT 1;
    `;

    const promptFinal = prompt.trim();
    const vozFinal = voz || process.env.RETELL_VOZ_PADRAO || "11labs-Adrian";
    const primeiraFala = saudacao || "Alô, tudo bem?";

    // ---- Atualizar agente existente ----
    if (existente.length && existente[0].llm_id) {
      const atualizacao = await chamarRetell(
        `/update-retell-llm/${existente[0].llm_id}`,
        { general_prompt: promptFinal },
        "PATCH"
      );
      if (!atualizacao.ok) {
        return NextResponse.json(
          { erro: `Retell recusou: ${JSON.stringify(atualizacao.dados).slice(0, 200)}` },
          { status: 502 }
        );
      }

      await chamarRetell(
        `/update-agent/${existente[0].retell_agent_id}`,
        { agent_name: nome || `Agente ${tipoFinal}`, voice_id: vozFinal, begin_message: primeiraFala },
        "PATCH"
      );

      await sql`
        UPDATE agentes SET nome = ${nome || ""}, prompt = ${promptFinal}, voz = ${vozFinal}
        WHERE cliente_id = ${clienteId} AND tipo = ${tipoFinal};
      `;

      return NextResponse.json({ ok: true, atualizado: true, mensagem: "Agente atualizado." });
    }

    // ---- Criar agente novo ----
    const llm = await chamarRetell("/create-retell-llm", {
      general_prompt: promptFinal,
      model: process.env.RETELL_MODELO_PADRAO || "claude-haiku-4",
    });
    if (!llm.ok || !llm.dados?.llm_id) {
      return NextResponse.json(
        { erro: `Não consegui criar o roteiro na Retell: ${JSON.stringify(llm.dados).slice(0, 200)}` },
        { status: 502 }
      );
    }

    const agente = await chamarRetell("/create-agent", {
      response_engine: { type: "retell-llm", llm_id: llm.dados.llm_id },
      voice_id: vozFinal,
      agent_name: nome || `Agente ${tipoFinal}`,
      language: "pt-BR",
      begin_message: primeiraFala,
      webhook_url: `${process.env.URL_DO_SITE || "https://sdr-ia-six.vercel.app"}/api/retell/webhook`,
    });
    if (!agente.ok || !agente.dados?.agent_id) {
      return NextResponse.json(
        { erro: `Não consegui criar o agente: ${JSON.stringify(agente.dados).slice(0, 200)}` },
        { status: 502 }
      );
    }

    await sql`
      INSERT INTO agentes (cliente_id, tipo, nome, retell_agent_id, llm_id, prompt, voz)
      VALUES (${clienteId}, ${tipoFinal}, ${nome || ""}, ${agente.dados.agent_id},
              ${llm.dados.llm_id}, ${promptFinal}, ${vozFinal})
      ON CONFLICT (cliente_id, tipo) DO UPDATE SET
        nome = EXCLUDED.nome, retell_agent_id = EXCLUDED.retell_agent_id,
        llm_id = EXCLUDED.llm_id, prompt = EXCLUDED.prompt, voz = EXCLUDED.voz;
    `;

    return NextResponse.json({ ok: true, mensagem: "Agente criado e pronto para ligar." });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
