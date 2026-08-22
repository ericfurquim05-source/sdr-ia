import { garantirTabelas, sql } from "@/lib/db";
import { enviarTexto, primeiroNomeApresentavel, ritmoDeDigitacao } from "@/lib/whatsapp";

/*
 * ============================================================
 * LEMBRETES DE REUNIÃO — DOIS TOQUES, NÃO TRÊS
 * ============================================================
 * 1. VÉSPERA (entre 24h e 3h antes): lembra e PEDE CONFIRMAÇÃO.
 *    É o que salva a reunião — dá tempo de remarcar se furou.
 * 2. EM CIMA (até 50min antes): "começa daqui a pouco", sem
 *    pergunta. Só um empurrão.
 * Três pings em meia hora (45/30/15) é robô ansioso; dois toques
 * bem dados é secretária.
 *
 * QUEM ACIONA: não há relógio frequente no plano da Vercel (cron
 * 1x/dia), então este motor pega carona em todo movimento do
 * sistema — fim de ligação, mensagem chegando, cron diário — e
 * na rota /api/lembretes, feita para um despertador externo
 * gratuito bater de 10 em 10 minutos e cobrir os dias parados.
 * As flags no banco garantem que ninguém recebe duas vezes.
 */

const TZ = "America/Sao_Paulo";

function horaSP() {
  return Number(
    new Date().toLocaleString("pt-BR", { timeZone: TZ, hour: "2-digit", hour12: false })
  );
}

function diaRelativo(inicio) {
  const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  const hoje = fmt(new Date());
  const alvo = fmt(new Date(inicio));
  const amanha = fmt(new Date(Date.now() + 86400000));
  if (alvo === hoje) return "hoje";
  if (alvo === amanha) return "amanhã";
  const d = new Date(inicio);
  return "dia " + d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "numeric", month: "numeric" });
}

function horaFalada(inicio) {
  return new Date(inicio).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function enviarBaloes(clienteId, telefone, baloes) {
  for (let i = 0; i < baloes.length; i++) {
    const envio = await enviarTexto({
      clienteId,
      precoConversa: 0, // lembrete não abre cobrança nova
      telefone,
      texto: baloes[i],
      ritmo: { delayMessage: i === 0 ? 2 : 2, delayTyping: ritmoDeDigitacao(baloes[i]) },
    });
    if (!envio.ok) return envio;
    await sql`
      INSERT INTO mensagens_wa (cliente_id, telefone, direcao, texto)
      VALUES (${clienteId}, ${telefone}, 'out', ${baloes[i]});
    `;
  }
  return { ok: true };
}

/** Roda uma passada de lembretes. Barata quando não há nada a fazer. */
export async function processarLembretes() {
  // Fora do horário social não se manda lembrete; a próxima
  // passada dentro da janela pega (as flags seguram a fila).
  const h = horaSP();
  if (h < 8 || h >= 21) return { enviados: 0, motivo: "fora_do_horario" };

  await garantirTabelas();
  let enviados = 0;

  // ---- 1. VÉSPERA: entre 24h e 3h antes, com pedido de confirmação ----
  const { rows: vesperas } = await sql`
    SELECT e.id, e.cliente_id, e.telefone, e.inicio,
           (SELECT nome FROM contatos c
             WHERE c.cliente_id = e.cliente_id AND c.telefone = e.telefone LIMIT 1) AS nome
    FROM eventos e
    WHERE e.telefone IS NOT NULL
      AND e.lembrete_vespera = FALSE
      AND e.inicio > NOW() + INTERVAL '3 hours'
      AND e.inicio <= NOW() + INTERVAL '24 hours'
    ORDER BY e.inicio ASC
    LIMIT 20;
  `;

  for (const ev of vesperas) {
    const nome = primeiroNomeApresentavel(ev.nome);
    const baloes = [
      `${nome ? "oi " + nome + "!" : "oi!"} passando pra lembrar da tua reunião com o Eric`,
      `${diaRelativo(ev.inicio)} às ${horaFalada(ev.inicio)}, tá confirmado pra ti?`,
    ];
    const envio = await enviarBaloes(ev.cliente_id, ev.telefone, baloes);
    // Marca mesmo se o envio falhar (ex.: número sem WhatsApp):
    // repetir a cada passada viraria martelo em porta fechada.
    await sql`UPDATE eventos SET lembrete_vespera = TRUE WHERE id = ${ev.id};`;
    if (envio.ok) enviados++;
  }

  // ---- 2. EM CIMA: até 50min antes, sem pergunta ----
  const { rows: emCima } = await sql`
    SELECT e.id, e.cliente_id, e.telefone, e.inicio,
           (SELECT nome FROM contatos c
             WHERE c.cliente_id = e.cliente_id AND c.telefone = e.telefone LIMIT 1) AS nome
    FROM eventos e
    WHERE e.telefone IS NOT NULL
      AND e.lembrete_hora = FALSE
      AND e.inicio > NOW() + INTERVAL '5 minutes'
      AND e.inicio <= NOW() + INTERVAL '50 minutes'
    ORDER BY e.inicio ASC
    LIMIT 20;
  `;

  for (const ev of emCima) {
    const baloes = [
      `opa! nossa reunião começa daqui a pouco, às ${horaFalada(ev.inicio)}`,
      `te espero lá 😊`,
    ];
    const envio = await enviarBaloes(ev.cliente_id, ev.telefone, baloes);
    // O em-cima também desliga a véspera: reunião marcada em cima
    // da hora não deve receber "confirma?" depois do "te espero".
    await sql`
      UPDATE eventos SET lembrete_hora = TRUE, lembrete_vespera = TRUE WHERE id = ${ev.id};
    `;
    if (envio.ok) enviados++;
  }

  return { enviados };
}
