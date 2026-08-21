import { garantirTabelas, sql } from "@/lib/db";
import { buscarOcupadosDoGoogle, slotOcupado } from "@/lib/google-agenda";

/*
 * ============================================================
 * AGENDA — REGRAS ÚNICAS PARA VOZ E WHATSAPP
 * ============================================================
 * As mesmas funções servem a Lara (durante a ligação, via Custom
 * Function da Retell) e a IA do WhatsApp. Assim a regra de
 * disponibilidade nunca fica diferente entre os dois canais.
 *
 * Atendimento: segunda a sábado, das 08:00 às 21:00.
 * Cruza a agenda interna com o Google Agenda do cliente.
 */

/*
 * JANELAS DE AGENDAMENTO (diferente do horário de LIGAR).
 * Ligar acontece das 8h às 21h. Mas reunião só é oferecida nas
 * faixas abaixo: fora delas o empresário quase nunca consegue
 * (almoço, chão de fábrica, fim de expediente).
 *
 * Formato: "inicio-fim" separado por vírgula, fim exclusivo.
 * "8-11,14-19" = das 8h às 10h e das 14h às 18h (último início 18h).
 * Ajustável pela variável JANELAS_AGENDAMENTO.
 */
const JANELAS = (process.env.JANELAS_AGENDAMENTO || "8-11,14-19")
  .split(",")
  .map((faixa) => faixa.split("-").map((n) => Number(n.trim())))
  .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a);

/** true se a hora cheia cabe em alguma janela de atendimento. */
function horaPermitida(h) {
  return JANELAS.some(([inicio, fim]) => h >= inicio && h < fim);
}

/** Texto humano das janelas, para a IA falar com o lead. */
function janelasEmTexto() {
  return JANELAS.map(([a, b]) => `das ${a}h às ${b}h`).join(" e ");
}

const HORA_MIN = Math.min(...JANELAS.map(([a]) => a));
const HORA_MAX = Math.max(...JANELAS.map(([, b]) => b));
const DIAS_A_FRENTE = 10;
const TZ = "America/Sao_Paulo";

/** Lista os horários realmente livres. */
export async function horariosLivres(clienteId, maxSugestoes = 6) {
  await garantirTabelas();

  const { rows: cli } = await sql`
    SELECT google_ics_url FROM clientes WHERE id = ${clienteId} LIMIT 1;
  `;
  let google = { ok: false, intervalos: [], diasCheios: new Set() };
  if (cli[0]?.google_ics_url) {
    google = await buscarOcupadosDoGoogle(cli[0].google_ics_url, DIAS_A_FRENTE);
  }

  const { rows: ocupados } = await sql`
    SELECT to_char(inicio AT TIME ZONE ${TZ}, 'YYYY-MM-DD HH24:00') AS slot
    FROM eventos
    WHERE cliente_id = ${clienteId}
      AND inicio BETWEEN NOW() AND NOW() + INTERVAL '10 days';
  `;
  const bloqueados = new Set(ocupados.map((o) => o.slot));

  // Data e hora AGORA em Brasília, calculadas de forma explícita para
  // não depender do fuso do servidor (a Vercel roda em UTC).
  const agora = new Date();
  const hojeISO = agora.toLocaleDateString("en-CA", { timeZone: TZ }); // aaaa-mm-dd
  const horaAgora = Number(
    agora.toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false })
  );

  const livres = [];

  for (let d = 0; d < DIAS_A_FRENTE && livres.length < maxSugestoes; d++) {
    // Soma dias sobre a data de Brasília, ao meio-dia UTC (evita virada de dia)
    const base = new Date(`${hojeISO}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + d);
    const dataISO = base.toISOString().slice(0, 10);
    const dia = new Date(`${dataISO}T12:00:00-03:00`);

    if (dia.getDay() === 0) continue; // domingo bloqueado

    for (let h = HORA_MIN; h < HORA_MAX && livres.length < maxSugestoes; h++) {
      if (!horaPermitida(h)) continue;              // fora das janelas de reunião
      if (d === 0 && h <= horaAgora + 1) continue;  // hoje: 2h de antecedência

      const chave = `${dataISO} ${String(h).padStart(2, "0")}:00`;
      if (bloqueados.has(chave)) continue;
      if (google.diasCheios.has(dataISO)) continue;

      const inicioSlot = new Date(`${dataISO}T${String(h).padStart(2, "0")}:00:00-03:00`);
      if (slotOcupado(inicioSlot, new Date(inicioSlot.getTime() + 3600000), google.intervalos)) continue;

      livres.push({
        data: dataISO,
        hora: `${String(h).padStart(2, "0")}:00`,
        dia_semana: dia.toLocaleDateString("pt-BR", { weekday: "long" }),
        data_falada: dia.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }),
      });
    }
  }

  return {
    horarios_livres: livres,
    google_sincronizado: google.ok,
    janelas: janelasEmTexto(),
  };
}

/** Agenda a reunião validando regra e conflito. */
export async function agendarReuniao({ clienteId, data, hora, nome, telefone, callId = null }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data)) || !/^\d{2}:\d{2}$/.test(String(hora))) {
    return { sucesso: false, motivo: "Data ou hora em formato inválido." };
  }

  const inicioSp = new Date(`${data}T${hora}:00-03:00`);
  if (inicioSp.getDay() === 0) {
    return { sucesso: false, motivo: "Domingo não tem atendimento. Ofereça de segunda a sábado." };
  }
  const h = Number(String(hora).slice(0, 2));
  if (!horaPermitida(h)) {
    return {
      sucesso: false,
      motivo: `Fora do horário de reuniões. O Eric atende ${janelasEmTexto()}. Ofereça um horário dessas faixas.`,
    };
  }
  if (String(hora).slice(3) !== "00") {
    return { sucesso: false, motivo: "As reuniões começam sempre na hora cheia. Ofereça um horário da lista." };
  }
  if (inicioSp.getTime() < Date.now()) {
    return { sucesso: false, motivo: "Esse horário já passou. Ofereça um horário futuro." };
  }

  await garantirTabelas();

  const { rows: conflito } = await sql`
    SELECT id FROM eventos
    WHERE cliente_id = ${clienteId}
      AND inicio = (${data + " " + hora})::timestamp AT TIME ZONE ${TZ}
    LIMIT 1;
  `;
  if (conflito.length) {
    return { sucesso: false, motivo: "Esse horário acabou de ser ocupado. Ofereça outro." };
  }

  await sql`
    INSERT INTO eventos (cliente_id, titulo, inicio, origem, telefone, call_id)
    VALUES (
      ${clienteId},
      ${"Reunião — " + (nome || telefone || "lead")},
      (${data + " " + hora})::timestamp AT TIME ZONE ${TZ},
      'ia', ${telefone ?? null}, ${callId}
    );
  `;

  return {
    sucesso: true,
    confirmacao: `Reunião confirmada para ${String(data).split("-").reverse().join("/")} às ${hora}.`,
  };
}
