import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * ============================================================
 * MELHORADOR DE ROTEIRO
 * ============================================================
 * O cliente escreve do jeito dele; a IA reescreve aplicando o
 * que a gente aprendeu nas ligações reais: abertura que não
 * parece telemarketing, pergunta aberta em vez de sim/não,
 * frases curtas, sem catálogo recitado.
 *
 * Requer ANTHROPIC_API_KEY.
 */

const INSTRUCOES = `Você reescreve roteiros de agentes de voz que fazem ligações telefônicas em português do Brasil.

Aplique estes princípios, aprendidos em centenas de ligações reais:

ABERTURA
- Nunca anunciar oferta na primeira frase. Quem atende não pediu para ouvir sobre o produto.
- Nunca pedir permissão para falar ("posso te contar o motivo?", "tem um minutinho?"). É a marca do telemarketing.
- Reconhecer a invasão desarma: algo como "te liguei meio do nada, já aviso".
- Começar perguntando sobre o negócio da pessoa, que é fácil de responder.

QUALIFICAÇÃO
- Trocar pergunta de sim/não por pergunta aberta. "Vocês têm algum projeto?" gera "não" automático.
- Perguntar COMO a pessoa já faz algo rende muito mais que perguntar SE ela quer algo.

CONVERSA
- Frases curtas, uma ideia por vez, no máximo duas frases e uma pergunta por turno.
- Não repetir o que a pessoa acabou de dizer.
- Não recitar lista de produtos: no máximo dois, e só os que respondem ao que ela trouxe.
- Números por extenso ("quinze minutos", não "15min").
- Não abrir todo turno com o mesmo marcador.

RECUSA
- Não aceitar o primeiro "não": tentar uma vez por outro ângulo, com pergunta aberta.
- No segundo "não", encerrar com elegância.
- Nunca usar frase que desiste pelo cliente ("não faz sentido eu insistir").

FORMATO DE SAÍDA
Devolva APENAS o roteiro reescrito, pronto para colar, organizado em blocos com tags
em minúsculas (exemplo: <abertura>, <conversa>, <agendamento>).
Não escreva comentários, explicações nem introdução. Só o roteiro.
Mantenha o idioma, o objetivo e as informações da empresa que vieram no original.
Se o original mencionar funções de agendamento, preserve as instruções sobre elas.`;

export async function POST(request) {
  try {
    await exigirAdmin();
  } catch {
    return NextResponse.json({ erro: "Acesso restrito ao console." }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { erro: "Melhorador indisponível: falta configurar a ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const { prompt, contexto } = await request.json();
    if (!prompt || prompt.trim().length < 30) {
      return NextResponse.json(
        { erro: "Escreva um pouco mais antes de melhorar." },
        { status: 400 }
      );
    }

    const resposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
        max_tokens: 3000,
        system: INSTRUCOES,
        messages: [
          {
            role: "user",
            content: `${contexto ? `CONTEXTO DA EMPRESA: ${contexto}\n\n` : ""}ROTEIRO ORIGINAL:\n\n${prompt}`,
          },
        ],
      }),
    });

    if (!resposta.ok) {
      const detalhe = (await resposta.text()).slice(0, 200);
      return NextResponse.json({ erro: `Falha ao melhorar: ${detalhe}` }, { status: 502 });
    }

    const dados = await resposta.json();
    const texto = dados?.content?.find((c) => c.type === "text")?.text?.trim();

    if (!texto) {
      return NextResponse.json({ erro: "A IA não devolveu texto." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, prompt: texto });
  } catch (e) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
