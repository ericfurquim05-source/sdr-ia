/*
 * ============================================================
 * TRANSCRIÇÃO DE ÁUDIO
 * ============================================================
 * Lead brasileiro responde por áudio o tempo todo. Sem transcrever,
 * a IA não sabe o que foi dito e precisa pedir para a pessoa
 * escrever — o que trava a conversa e soa mal.
 *
 * Aqui o áudio recebido é baixado e convertido em texto pelo
 * Whisper (OpenAI). Requer OPENAI_API_KEY.
 * Custo aproximado: R$ 0,03 por minuto de áudio.
 */

const LIMITE_MB = 24; // teto do endpoint
const TEMPO_LIMITE_MS = 45000;

export function transcricaoDisponivel() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Baixa o áudio da URL e devolve o texto falado.
 * Retorna null se não conseguir — nesse caso a conversa segue
 * com "[áudio recebido]", sem quebrar nada.
 */
export async function transcreverAudio(url) {
  if (!transcricaoDisponivel() || !url) return null;

  try {
    // 1. Baixa o arquivo
    const audio = await fetch(url, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) });
    if (!audio.ok) return null;

    const bytes = await audio.arrayBuffer();
    if (bytes.byteLength > LIMITE_MB * 1024 * 1024) return null;

    // 2. Monta o envio no formato que o endpoint espera
    const tipo = audio.headers.get("content-type") || "audio/ogg";
    const extensao = tipo.includes("mp3")
      ? "mp3"
      : tipo.includes("mp4") || tipo.includes("m4a")
        ? "m4a"
        : tipo.includes("wav")
          ? "wav"
          : "ogg";

    const formulario = new FormData();
    formulario.append("file", new Blob([bytes], { type: tipo }), `audio.${extensao}`);
    formulario.append("model", process.env.OPENAI_MODELO_AUDIO || "whisper-1");
    formulario.append("language", "pt");
    // Ajuda o modelo com nomes e termos do nosso contexto
    formulario.append(
      "prompt",
      "Conversa comercial em português do Brasil sobre crédito, consórcio, financiamento, carta contemplada, reunião e agendamento."
    );

    // 3. Transcreve
    const resposta = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formulario,
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });

    if (!resposta.ok) {
      console.error("transcricao_falhou:", (await resposta.text()).slice(0, 200));
      return null;
    }

    const dados = await resposta.json();
    const texto = String(dados?.text || "").trim();
    return texto.length > 1 ? texto : null;
  } catch (e) {
    console.error("transcricao_erro:", String(e?.message || e).slice(0, 150));
    return null;
  }
}
