import { NextResponse } from "next/server";
import { exigirCliente } from "@/lib/auth";
import { assumirLead, concluirLead, devolverLead } from "@/lib/equipe";

export const dynamic = "force-dynamic";

/*
 * Ações do corretor sobre um lead: assumir, concluir ou devolver.
 * O telefone só é revelado na resposta de "assumir" — antes disso
 * a tela não mostra o número.
 */
export async function POST(request) {
  let cliente;
  try {
    cliente = await exigirCliente();
  } catch {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }

  try {
    const { acao, ligacaoId, desfecho, usuarioId } = await request.json();
    const quem = usuarioId ?? cliente.id; // conta sem equipe: o próprio dono

    if (acao === "assumir") {
      const r = await assumirLead({ clienteId: cliente.id, usuarioId: quem, ligacaoId });
      if (!r.ok) return NextResponse.json({ erro: r.motivo }, { status: 409 });
      return NextResponse.json({ ok: true, lead: r.lead, mensagem: "Contato assumido." });
    }

    if (acao === "concluir") {
      const ok = await concluirLead({
        clienteId: cliente.id,
        usuarioId: quem,
        ligacaoId,
        desfecho: desfecho || "concluido",
      });
      return ok
        ? NextResponse.json({ ok: true, mensagem: "Contato concluído." })
        : NextResponse.json({ erro: "Não foi possível concluir." }, { status: 400 });
    }

    if (acao === "devolver") {
      const ok = await devolverLead({ clienteId: cliente.id, usuarioId: quem, ligacaoId });
      return ok
        ? NextResponse.json({ ok: true, mensagem: "Contato devolvido para a equipe." })
        : NextResponse.json({ erro: "Não foi possível devolver." }, { status: 400 });
    }

    return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
