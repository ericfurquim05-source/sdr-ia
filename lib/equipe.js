import { garantirTabelas, sql } from "@/lib/db";

/*
 * ============================================================
 * EQUIPE DO CLIENTE — GESTOR E CORRETORES
 * ============================================================
 * O cliente é a EMPRESA: dona do saldo, do contrato e do preço.
 * Dentro dela existem usuários com dois papéis:
 *
 *   gestor    → enxerga a operação inteira: carteira, custos,
 *               campanhas, desempenho de cada pessoa da equipe.
 *   corretor  → enxerga só o próprio trabalho: leads livres para
 *               assumir e os que já assumiu. Nunca vê dinheiro.
 *
 * DISTRIBUIÇÃO DE LEAD
 * A oportunidade nasce livre. Quem assume, tira dos outros — assim
 * ninguém liga duas vezes para o mesmo contato. O telefone só
 * aparece DEPOIS de assumir, para evitar que alguém anote números
 * e trabalhe por fora.
 */

// Máximo de leads em aberto por corretor (evita acúmulo sem trabalho)
const LIMITE_EM_ABERTO = Number(process.env.LIMITE_LEADS_CORRETOR || 10);
// Assumiu e não deu desfecho? Volta para a equipe.
const HORAS_PARA_DEVOLVER = Number(process.env.HORAS_DEVOLVER_LEAD || 48);

export function ehGestor(usuario) {
  return usuario?.papel === "gestor";
}

/** Devolve à equipe os leads parados há muito tempo. */
export async function devolverLeadsParados(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    UPDATE ligacoes
    SET assumido_por = NULL, assumido_em = NULL
    WHERE cliente_id = ${clienteId}
      AND assumido_por IS NOT NULL
      AND desfecho_equipe IS NULL
      AND assumido_em < NOW() - (${HORAS_PARA_DEVOLVER}::int * INTERVAL '1 hour')
    RETURNING id;
  `;
  return rows.length;
}

/** Um corretor assume um lead. Falha se já foi assumido por outro. */
export async function assumirLead({ clienteId, usuarioId, ligacaoId }) {
  await garantirTabelas();
  await devolverLeadsParados(clienteId);

  const { rows: abertos } = await sql`
    SELECT COUNT(*)::int AS total FROM ligacoes
    WHERE cliente_id = ${clienteId} AND assumido_por = ${usuarioId}
      AND desfecho_equipe IS NULL;
  `;
  if ((abertos[0]?.total ?? 0) >= LIMITE_EM_ABERTO) {
    return {
      ok: false,
      motivo: `Você já tem ${LIMITE_EM_ABERTO} contatos em aberto. Conclua alguns antes de assumir outro.`,
    };
  }

  // Só assume se ainda estiver livre — evita dois pegando o mesmo
  const { rows } = await sql`
    UPDATE ligacoes
    SET assumido_por = ${usuarioId}, assumido_em = NOW()
    WHERE id = ${ligacaoId} AND cliente_id = ${clienteId} AND assumido_por IS NULL
    RETURNING id, telefone, nome;
  `;
  if (!rows.length) {
    return { ok: false, motivo: "Este contato acabou de ser assumido por outra pessoa." };
  }
  return { ok: true, lead: rows[0] };
}

/** O corretor registra o que aconteceu e libera a vaga. */
export async function concluirLead({ clienteId, usuarioId, ligacaoId, desfecho }) {
  await garantirTabelas();
  const { rows } = await sql`
    UPDATE ligacoes SET desfecho_equipe = ${desfecho}
    WHERE id = ${ligacaoId} AND cliente_id = ${clienteId} AND assumido_por = ${usuarioId}
    RETURNING id;
  `;
  return rows.length > 0;
}

/** Devolve um lead para a equipe. */
export async function devolverLead({ clienteId, usuarioId, ligacaoId }) {
  await garantirTabelas();
  const { rows } = await sql`
    UPDATE ligacoes SET assumido_por = NULL, assumido_em = NULL
    WHERE id = ${ligacaoId} AND cliente_id = ${clienteId} AND assumido_por = ${usuarioId}
    RETURNING id;
  `;
  return rows.length > 0;
}

/** Desempenho da equipe — visível apenas para o gestor. */
export async function desempenhoDaEquipe(clienteId) {
  await garantirTabelas();
  const { rows } = await sql`
    SELECT
      u.id, u.nome, u.papel,
      COUNT(l.id) FILTER (WHERE l.assumido_por = u.id)::int AS assumidos,
      COUNT(l.id) FILTER (WHERE l.assumido_por = u.id AND l.desfecho_equipe IS NULL)::int AS em_aberto,
      COUNT(l.id) FILTER (WHERE l.assumido_por = u.id AND l.desfecho_equipe = 'reuniao')::int AS reunioes
    FROM usuarios u
    LEFT JOIN ligacoes l ON l.cliente_id = u.cliente_id
    WHERE u.cliente_id = ${clienteId} AND u.ativo = TRUE
    GROUP BY u.id, u.nome, u.papel
    ORDER BY reunioes DESC, assumidos DESC;
  `;
  return rows;
}
