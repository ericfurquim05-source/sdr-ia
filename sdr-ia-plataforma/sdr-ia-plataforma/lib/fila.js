import { garantirTabela, sql } from "@/lib/db";
import { dispararLigacao } from "@/lib/retell";

/*
 * ============================================================
 * WORKER DA FILA — PEGA 1 PENDENTE E LIGA
 * ============================================================
 * Regra: apenas UMA ligação ativa por vez. O próximo contato só
 * é discado quando o webhook call_ended/erro devolve a vez.
 *
 * O SELECT usa FOR UPDATE SKIP LOCKED para que duas execuções
 * simultâneas nunca peguem o mesmo contato.
 */

const LIMITE_TENTATIVAS = 7;

export async function processarProximoDaFila() {
  await garantirTabela();

  // Já existe ligação em andamento? Então espera a vez.
  const { rows: ativas } = await sql`
    SELECT id FROM contatos WHERE status = 'EM_LIGACAO' LIMIT 1;
  `;
  if (ativas.length > 0) {
    return { disparou: false, motivo: "ja_ha_ligacao_em_andamento" };
  }

  // Pega o próximo da fila (menos tentativas primeiro, depois mais antigo)
  const { rows } = await sql`
    UPDATE contatos SET status = 'EM_LIGACAO', atualizado_em = NOW()
    WHERE id = (
      SELECT id FROM contatos
      WHERE status = 'PENDENTE' AND tentativas < ${LIMITE_TENTATIVAS}
      ORDER BY tentativas ASC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, nome, telefone, tentativas, agente;
  `;

  if (rows.length === 0) {
    return { disparou: false, motivo: "fila_vazia" };
  }

  const contato = rows[0];
  const resultado = await dispararLigacao(contato);

  if (resultado.ok) {
    await sql`
      UPDATE contatos SET call_id = ${resultado.callId}, atualizado_em = NOW()
      WHERE id = ${contato.id};
    `;
    return { disparou: true, contatoId: contato.id, callId: resultado.callId };
  }

  // A operadora/API recusou na hora do disparo: conta como tentativa falha
  return await registrarFalha(contato.id, `erro_disparo: ${resultado.detalhe}`);
}

/**
 * Falha (não atendeu, caixa postal, erro, queda <= 13s):
 * +1 tentativa; volta para PENDENTE até a 7ª, quando vira ESGOTADO.
 */
export async function registrarFalha(contatoId, motivo) {
  const { rows } = await sql`
    UPDATE contatos SET
      tentativas    = tentativas + 1,
      status        = CASE WHEN tentativas + 1 >= ${LIMITE_TENTATIVAS} THEN 'ESGOTADO' ELSE 'PENDENTE' END,
      ultimo_motivo = ${motivo},
      call_id       = NULL,
      atualizado_em = NOW()
    WHERE id = ${contatoId}
    RETURNING status, tentativas;
  `;
  return { disparou: false, falha: true, novoStatus: rows[0]?.status, tentativas: rows[0]?.tentativas };
}

/** Sucesso: cliente atendeu e conversou por mais de 13 segundos. */
export async function registrarSucesso(contatoId, motivo) {
  await sql`
    UPDATE contatos SET
      status        = 'CONCLUIDA',
      ultimo_motivo = ${motivo},
      atualizado_em = NOW()
    WHERE id = ${contatoId};
  `;
}

/** Localiza o contato pela chamada (metadata.contato_id ou call_id). */
export async function acharContatoDaChamada(metadata, callId) {
  await garantirTabela();
  const idMeta = metadata?.contato_id;
  if (idMeta) {
    const { rows } = await sql`SELECT * FROM contatos WHERE id = ${idMeta} LIMIT 1;`;
    if (rows.length) return rows[0];
  }
  if (callId) {
    const { rows } = await sql`SELECT * FROM contatos WHERE call_id = ${callId} LIMIT 1;`;
    if (rows.length) return rows[0];
  }
  return null;
}
