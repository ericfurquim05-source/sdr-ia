import { NextResponse } from "next/server";
import { exigirCliente } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { normalizarTelefone } from "@/lib/planilha";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * ============================================================
 * IMPORTAR HISTÓRICO DA RETELL
 * ============================================================
 * Traz para dentro do site as ligações que já aconteceram —
 * inclusive as anteriores ao ajuste do webhook, que a Retell
 * guardou mas o site nunca recebeu.
 *
 * Uso: abra /api/importar/retell no navegador, logado.
 * Pode rodar quantas vezes quiser: o call_id é único, então
 * nada é duplicado e nada é cobrado de novo.
 */
export async function GET() {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  if (!process.env.RETELL_API_KEY) {
    return NextResponse.json({ erro: "RETELL_API_KEY não configurada." }, { status: 500 });
  }

  try {
    await garantirTabelas();

    // Busca as chamadas mais recentes da conta
    const resposta = await fetch("https://api.retellai.com/v2/list-calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit: 300, sort_order: "descending" }),
    });

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 300);
      return NextResponse.json({ erro: `Retell recusou: ${detalhe}` }, { status: 502 });
    }

    const chamadas = await resposta.json();
    const lista = Array.isArray(chamadas) ? chamadas : chamadas.calls ?? [];

    // Prefixo do tronco para recuperar o telefone local a partir do to_number
    const prefixo = (process.env.RETELL_PREFIXO_DISCAGEM || "").replace(/\D/g, "");

    let importadas = 0;
    let jaExistiam = 0;

    for (const c of lista) {
      const callId = c.call_id;
      if (!callId) continue;

      const duracaoMs =
        c.duration_ms ??
        (c.end_timestamp && c.start_timestamp ? c.end_timestamp - c.start_timestamp : 0);

      // to_number vem com o prefixo do tronco; remove para guardar o local
      let destino = String(c.to_number || "").replace(/\D/g, "");
      if (prefixo && destino.startsWith(prefixo)) destino = destino.slice(prefixo.length);
      const telefone = normalizarTelefone(destino) || destino;

      const motivo = c.disconnection_reason || c.call_status || "importada";
      const sucesso = duracaoMs > 13000 && !/no_answer|busy|failed|voicemail|error/i.test(motivo);

      // Nome: tenta casar com um contato já existente na fila
      const { rows: contato } = await sql`
        SELECT nome FROM contatos
        WHERE cliente_id = ${cliente.id} AND telefone = ${telefone} LIMIT 1;
      `;

      const transcricao =
        typeof c.transcript === "string"
          ? c.transcript
          : Array.isArray(c.transcript_object)
            ? c.transcript_object.map((t) => `${t.role}: ${t.content}`).join("\n")
            : null;

      const { rows: inserido } = await sql`
        INSERT INTO ligacoes
          (cliente_id, call_id, nome, telefone, agente, duracao_ms, motivo,
           sucesso, custo, recording_url, transcript, resumo, criado_em)
        VALUES
          (${cliente.id}, ${callId}, ${contato[0]?.nome ?? ""}, ${telefone}, 'fria',
           ${duracaoMs}, ${motivo}, ${sucesso}, 0,
           ${c.recording_url ?? null}, ${transcricao},
           ${c.call_analysis?.call_summary ?? null},
           to_timestamp(${(c.start_timestamp ?? Date.now()) / 1000}))
        ON CONFLICT (call_id) DO NOTHING
        RETURNING id;
      `;

      if (inserido.length) importadas++;
      else jaExistiam++;
    }

    return NextResponse.json({
      ok: true,
      encontradas_na_retell: lista.length,
      importadas,
      ja_existiam: jaExistiam,
      mensagem: `${importadas} ligações importadas. Abra a aba SDR IA e ajuste o filtro de data para vê-las.`,
    });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 400) }, { status: 500 });
  }
}
