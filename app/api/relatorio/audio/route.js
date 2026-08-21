import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { detectarSinais } from "@/lib/sinais";

export const dynamic = "force-dynamic";

/*
 * ============================================================
 * RELATÓRIO DE QUALIDADE DE ÁUDIO
 * ============================================================
 * Junta duas evidências para abrir chamado com a operadora:
 *  1. Reclamação explícita na transcrição ("não consigo entender",
 *     "está abafado", "cortando")
 *  2. Sinal técnico da Retell (error_no_audio_received, error_asr)
 *
 * Gera um CSV com data, hora, call_id, número e o trecho da fala —
 * é o que a operadora precisa para rastrear no CDR dela.
 */
export async function GET(request) {
  const cliente = await clienteLogado();
  if (!cliente) return new Response("Faça login.", { status: 401 });

  const url = new URL(request.url);
  const dias = Math.min(Number(url.searchParams.get("dias")) || 7, 90);

  await garantirTabelas();
  const { rows } = await sql`
    SELECT id, call_id, nome, telefone, duracao_ms::int AS duracao_ms,
           motivo, sucesso, transcript,
           criado_em AT TIME ZONE 'America/Sao_Paulo' AS quando
    FROM ligacoes
    WHERE cliente_id = ${cliente.id}
      AND criado_em > NOW() - (${dias}::int * INTERVAL '1 day')
    ORDER BY criado_em DESC
    LIMIT 2000;
  `;

  // Frases que indicam falha de áudio percebida pelo interlocutor
  const RECLAMACAO =
    /n[aã]o (estou |to |consigo )?(conseguindo )?(te )?(entender|ouvir|escutar)|abafado|cortando|chiado|chiando|ligação (est[aá]|t[aá]) ruim|repet(e|ir)|n[aã]o entendi nada|muito perto do microfone/i;
  const ERRO_TECNICO = /error_no_audio_received|error_asr|error_unknown/i;

  const ruins = [];
  let atendidas = 0;

  for (const l of rows) {
    const texto = String(l.transcript || "");
    // Considera "atendida" o que teve conversa real, para calcular a taxa
    if (l.duracao_ms > 5000) atendidas++;

    const reclamou = RECLAMACAO.test(texto);
    const erroTecnico = ERRO_TECNICO.test(String(l.motivo));
    if (!reclamou && !erroTecnico) continue;

    // Extrai a frase exata da reclamação, para anexar no chamado
    const trecho =
      texto
        .split("\n")
        .find((linha) => RECLAMACAO.test(linha))
        ?.replace(/^(user|lead|cliente)\s*:\s*/i, "")
        .trim()
        .slice(0, 160) || "(erro técnico registrado pela plataforma)";

    ruins.push({
      quando: new Date(l.quando).toLocaleString("pt-BR"),
      call_id: l.call_id || "",
      telefone: l.telefone,
      duracao: Math.round(l.duracao_ms / 1000),
      motivo: l.motivo,
      evidencia: reclamou ? "reclamação do interlocutor" : "erro técnico de áudio",
      trecho,
    });
  }

  const percentual = atendidas ? Math.round((ruins.length / atendidas) * 100) : 0;

  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = [
    `# RELATORIO DE QUALIDADE DE AUDIO - ultimos ${dias} dias`,
    `# Chamadas com conversa: ${atendidas}`,
    `# Chamadas com falha de audio: ${ruins.length} (${percentual}%)`,
    "",
    "data_hora;call_id;telefone;duracao_segundos;desfecho;evidencia;fala_registrada",
    ...ruins.map((r) =>
      [
        r.quando,
        r.call_id,
        r.telefone,
        r.duracao,
        esc(r.motivo),
        r.evidencia,
        esc(r.trecho),
      ].join(";")
    ),
  ];

  return new Response("\uFEFF" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="qualidade-audio-${dias}dias.csv"`,
    },
  });
}
