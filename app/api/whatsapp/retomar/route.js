import { NextResponse } from "next/server";
import { exigirCliente } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { enviarTemplate, canalAtivo } from "@/lib/whatsapp";
import { detectarSinais, nivelPrioridade } from "@/lib/sinais";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * ============================================================
 * RETOMAR CONVERSAS
 * ============================================================
 * Junta todo mundo que conversou de verdade ao telefone e ainda
 * não recebeu mensagem, e manda o primeiro contato pelo WhatsApp.
 *
 * Critério: atendeu, falou mais de 1min10, e nenhuma mensagem
 * trocada até agora. É a mesma régua do follow-up automático.
 *
 * Envia em lotes para não estourar o tempo da rota: a tela chama
 * de novo até acabar, mostrando o progresso.
 */

const POR_LOTE = 8;
const ESPERA_MS = 6000; // espaçamento entre mensagens, dentro do lote

export async function GET() {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  await garantirTabelas();
  const { rows } = await sql`
    SELECT COUNT(*)::int AS total FROM (
      SELECT DISTINCT l.telefone
      FROM ligacoes l
      WHERE l.cliente_id = ${cliente.id}
        AND l.sucesso = TRUE
        AND l.duracao_ms >= 70000
        AND NOT EXISTS (
          SELECT 1 FROM mensagens_wa m
          WHERE m.cliente_id = l.cliente_id AND m.telefone = l.telefone
        )
    ) x;
  `;

  return NextResponse.json({
    aguardando: rows[0]?.total ?? 0,
    canal: canalAtivo(),
  });
}

export async function POST() {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  if (!canalAtivo()) {
    return NextResponse.json({ erro: "WhatsApp não está conectado." }, { status: 400 });
  }

  try {
    await garantirTabelas();

    // Quem conversou de verdade e ainda não recebeu nada.
    // Traz a transcrição junto para classificar a fila.
    const { rows: pendentes } = await sql`
      SELECT DISTINCT ON (l.telefone)
             l.telefone, l.nome, l.duracao_ms::int AS duracao_ms,
             l.transcript, l.resumo
      FROM ligacoes l
      WHERE l.cliente_id = ${cliente.id}
        AND l.sucesso = TRUE
        AND l.duracao_ms >= 70000
        AND NOT EXISTS (
          SELECT 1 FROM mensagens_wa m
          WHERE m.cliente_id = l.cliente_id AND m.telefone = l.telefone
        )
      ORDER BY l.telefone, l.duracao_ms DESC
      LIMIT 400;
    `;

    /*
     * ORDEM DA FILA — quem recebe a mensagem primeiro:
     *   1. prioridade ALTA  (sinal forte ou conversa longa com sinal)
     *   2. prioridade BAIXA (sinal morno: retorno, e-mail, mais adiante)
     *   3. tem ETIQUETA, mas não virou oportunidade
     *   4. sem etiqueta nenhuma
     * Empate dentro do grupo: quem conversou mais tempo vai antes.
     */
    const leads = pendentes
      .map((lead) => {
        const sinais = detectarSinais(lead);
        const nivel = nivelPrioridade(sinais, lead.duracao_ms);
        const grupo =
          nivel === "alta" ? 1 : nivel === "baixa" ? 2 : sinais.length > 0 ? 3 : 4;
        return { ...lead, grupo };
      })
      .sort((a, b) => a.grupo - b.grupo || b.duracao_ms - a.duracao_ms)
      .slice(0, POR_LOTE);

    if (leads.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0, restam: 0, concluido: true });
    }

    const { rows: cli } = await sql`
      SELECT preco_conversa FROM clientes WHERE id = ${cliente.id} LIMIT 1;
    `;
    const preco = cli[0]?.preco_conversa ?? 0.5;

    let enviados = 0;
    const falhas = [];

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const r = await enviarTemplate({
        clienteId: cliente.id,
        precoConversa: preco,
        telefone: lead.telefone,
        nome: lead.nome,
        ignorarIntervalo: true, // o lote já tem espaçamento próprio
      });

      if (r.ok) enviados++;
      else falhas.push({ telefone: lead.telefone, motivo: r.motivo });

      // Espaça as mensagens: rajada é o que derruba número
      if (i < leads.length - 1) {
        await new Promise((res) => setTimeout(res, ESPERA_MS));
      }
    }

    // Quantos ainda faltam
    const { rows: restantes } = await sql`
      SELECT COUNT(*)::int AS total FROM (
        SELECT DISTINCT l.telefone
        FROM ligacoes l
        WHERE l.cliente_id = ${cliente.id}
          AND l.sucesso = TRUE
          AND l.duracao_ms >= 70000
          AND NOT EXISTS (
            SELECT 1 FROM mensagens_wa m
            WHERE m.cliente_id = l.cliente_id AND m.telefone = l.telefone
          )
      ) x;
    `;
    const restam = restantes[0]?.total ?? 0;

    return NextResponse.json({
      ok: true,
      enviados,
      restam,
      concluido: restam === 0,
      falhas: falhas.slice(0, 5),
    });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
