import WhatsappConversas from "@/components/WhatsappConversas";
import { clienteLogado } from "@/lib/auth";
import { garantirTabelas, sql } from "@/lib/db";
import { detectarSinais, nivelPrioridade } from "@/lib/sinais";
import { whatsappConfigurado, canalAtivo, verificarConexao } from "@/lib/whatsapp";
import { autorespostaLigada } from "@/lib/ia";

export const dynamic = "force-dynamic";

/*
 * WhatsApp — conversas REAIS da tabela mensagens_wa.
 * Sem número conectado, a tela mostra o guia de conexão
 * (não existem mais dados de demonstração aqui).
 */
export default async function Whatsapp() {
  let conversas = [];
  let conectado = false;
  let iaLigada = false;
  let canal = null;
  let estado = null;

  try {
    const cliente = await clienteLogado();
    conectado = whatsappConfigurado();
    canal = canalAtivo();
    // Confirma na fonte se o celular está mesmo conectado
    if (canal === "zapi") estado = await verificarConexao();
    iaLigada = autorespostaLigada();

    if (cliente) {
      await garantirTabelas();
      // Contexto do lead: etiquetas e prioridade vindas da ligação.
      // Aparecem só para quem opera o site — o lead nunca vê.
      const { rows: ligacoes } = await sql`
        SELECT DISTINCT ON (telefone)
               telefone, transcript, resumo, duracao_ms::int AS duracao_ms
        FROM ligacoes
        WHERE cliente_id = ${cliente.id}
        ORDER BY telefone, criado_em DESC;
      `;
      const contextoPorTelefone = new Map(
        ligacoes.map((l) => {
          const sinais = detectarSinais(l);
          return [
            l.telefone,
            {
              sinais: sinais.map((s) => ({ rotulo: s.rotulo, cor: s.cor })),
              prioridade: nivelPrioridade(sinais, l.duracao_ms),
              resumo: l.resumo,
            },
          ];
        })
      );

      const { rows: msgs } = await sql`
        SELECT telefone, direcao, texto, midia_url, midia_tipo, criado_em FROM mensagens_wa
        WHERE cliente_id = ${cliente.id}
        ORDER BY criado_em ASC
        LIMIT 500;
      `;
      const { rows: nomes } = await sql`
        SELECT telefone, nome FROM contatos WHERE cliente_id = ${cliente.id};
      `;
      const nomePor = new Map(nomes.map((n) => [n.telefone, n.nome]));

      const porTelefone = new Map();
      for (const m of msgs) {
        if (!porTelefone.has(m.telefone)) {
          porTelefone.set(m.telefone, {
            telefone: m.telefone,
            nome: nomePor.get(m.telefone) || "",
            mensagens: [],
          });
        }
        porTelefone.get(m.telefone).mensagens.push({
          direcao: m.direcao,
          texto: m.texto,
          midiaUrl: m.midia_url,
          midiaTipo: m.midia_tipo,
          criado_em: m.criado_em.toISOString(),
        });
      }
      conversas = [...porTelefone.values()].sort((a, b) => {
        const ua = a.mensagens[a.mensagens.length - 1].criado_em;
        const ub = b.mensagens[b.mensagens.length - 1].criado_em;
        return ub.localeCompare(ua);
      });
    }
  } catch {
    conversas = [];
  }

  return (
    <WhatsappConversas
      conversas={conversas}
      conectado={conectado}
      iaLigada={iaLigada}
      canal={canal}
      estado={estado}
    />
  );
}
