import { NextResponse } from "next/server";
import { exigirCliente } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { buscarOcupadosDoGoogle } from "@/lib/google-agenda";

/*
 * Salva (ou remove) a URL secreta iCal do Google Agenda do cliente.
 * Antes de salvar, testa a URL de verdade — evita colar link errado.
 */
export async function POST(request) {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  try {
    const { url } = await request.json();
    await garantirTabelas();

    // Campo vazio = desconectar
    if (!url || !String(url).trim()) {
      await sql`UPDATE clientes SET google_ics_url = NULL WHERE id = ${cliente.id};`;
      return NextResponse.json({ ok: true, mensagem: "Google Agenda desconectado." });
    }

    const limpa = String(url).trim();
    if (!/^https:\/\//.test(limpa) || !limpa.includes(".ics")) {
      return NextResponse.json(
        { erro: "Cole o Endereço secreto no formato iCal (termina em .ics)." },
        { status: 400 }
      );
    }

    const teste = await buscarOcupadosDoGoogle(limpa, 7);
    if (!teste.ok) {
      return NextResponse.json(
        { erro: "Não consegui ler essa agenda. Confira se copiou o Endereço secreto iCal completo." },
        { status: 400 }
      );
    }

    await sql`UPDATE clientes SET google_ics_url = ${limpa} WHERE id = ${cliente.id};`;
    return NextResponse.json({
      ok: true,
      mensagem: `Google Agenda conectado! ${teste.intervalos.length + teste.diasCheios.size} compromissos encontrados nos próximos dias — a IA já vai respeitá-los.`,
    });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
