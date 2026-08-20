import { NextResponse } from "next/server";
import { clienteLogado } from "@/lib/auth";

export const dynamic = "force-dynamic";

/*
 * Informa à tela de Campanhas o prefixo do tronco SIP configurado,
 * para que a planilha padronizada seja baixada no MESMO formato que
 * o discador usa (ex.: 968655 + DDD + número).
 * Só o prefixo é exposto — nenhuma chave sai daqui.
 */
export async function GET() {
  const cliente = await clienteLogado();
  if (!cliente) return NextResponse.json({ prefixo: "" }, { status: 401 });

  return NextResponse.json({
    prefixo: (process.env.RETELL_PREFIXO_DISCAGEM || "").replace(/\D/g, ""),
  });
}
