/*
 * ============================================================
 * SINCRONIZAÇÃO COM O GOOGLE AGENDA (leitura automática)
 * ============================================================
 * Usa o "endereço secreto em formato iCal" do Google Calendar:
 * uma URL que entrega os compromissos sem OAuth nem app no Google.
 * (Google Agenda → Configurações da agenda → Integrar agenda →
 *  "Endereço secreto no formato iCal")
 *
 * A cada consulta de horários pela IA, o site busca essa URL e
 * bloqueia os horários que já estão ocupados no Google.
 * Somente leitura — nada é alterado na agenda do cliente.
 */

// Desdobra linhas continuadas do formato iCal (começam com espaço)
function desdobrar(texto) {
  return texto.replace(/\r?\n[ \t]/g, "");
}

// Converte um valor de data do iCal em Date (UTC interno)
function parseData(valor, params) {
  // Dia inteiro: VALUE=DATE:20260820
  if (/^\d{8}$/.test(valor)) {
    return { allDay: true, data: valor };
  }
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, a, mes, d, h, min, s, z] = m;

  if (z === "Z") {
    return { allDay: false, date: new Date(Date.UTC(+a, +mes - 1, +d, +h, +min, +s)) };
  }
  // Sem Z: horário local do TZID. Agenda brasileira → -03:00.
  // (Se o cliente usar outro fuso no Google, ajustar aqui.)
  return { allDay: false, date: new Date(`${a}-${mes}-${d}T${h}:${min}:${s}-03:00`) };
}

/**
 * Busca a URL iCal e devolve os intervalos ocupados no período.
 * Retorna { ok, intervalos: [{inicio: Date, fim: Date}], diasCheios: Set("YYYY-MM-DD") }.
 */
export async function buscarOcupadosDoGoogle(icsUrl, diasAFrente = 14) {
  try {
    const resposta = await fetch(icsUrl, {
      signal: AbortSignal.timeout(6000),
      // O Google entrega .ics público na URL secreta
      headers: { "User-Agent": "sdr-ia-agenda" },
    });
    if (!resposta.ok) return { ok: false, intervalos: [], diasCheios: new Set() };

    const texto = desdobrar(await resposta.text());
    if (!texto.includes("BEGIN:VCALENDAR")) {
      return { ok: false, intervalos: [], diasCheios: new Set() };
    }

    const agora = Date.now();
    const limite = agora + diasAFrente * 86400000;
    const intervalos = [];
    const diasCheios = new Set();

    // Percorre cada VEVENT
    const eventos = texto.split("BEGIN:VEVENT").slice(1);
    for (const bloco of eventos) {
      const linha = (nome) => {
        const m = bloco.match(new RegExp(`^${nome}(;[^:]*)?:(.+)$`, "m"));
        return m ? { params: m[1] || "", valor: m[2].trim() } : null;
      };

      // Eventos recorrentes (RRULE) não são expandidos nesta versão
      const inicio = linha("DTSTART");
      const fim = linha("DTEND");
      if (!inicio) continue;

      const pi = parseData(inicio.valor, inicio.params);
      if (!pi) continue;

      if (pi.allDay) {
        // Dia inteiro: bloqueia o dia todo
        const d = `${pi.data.slice(0, 4)}-${pi.data.slice(4, 6)}-${pi.data.slice(6, 8)}`;
        diasCheios.add(d);
        continue;
      }

      const pf = fim ? parseData(fim.valor, fim.params) : null;
      const fimDate = pf?.date ?? new Date(pi.date.getTime() + 3600000); // sem fim: assume 1h

      // Só interessa o que cai na janela de consulta
      if (fimDate.getTime() < agora || pi.date.getTime() > limite) continue;

      intervalos.push({ inicio: pi.date, fim: fimDate });
    }

    return { ok: true, intervalos, diasCheios };
  } catch {
    // Google fora do ar ou URL inválida: segue só com a agenda interna
    return { ok: false, intervalos: [], diasCheios: new Set() };
  }
}

/** true se o slot [inicioSlot, fimSlot) colide com algum intervalo. */
export function slotOcupado(inicioSlot, fimSlot, intervalos) {
  return intervalos.some((i) => inicioSlot < i.fim && fimSlot > i.inicio);
}
