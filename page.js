export const metadata = {
  title: "Política de Privacidade — SDR IA",
  description:
    "Como o SDR IA coleta, usa, compartilha e protege dados pessoais em campanhas de prospecção por voz e WhatsApp.",
};

const ATUALIZADO_EM = "20 de agosto de 2026";
const CONTATO = "empresasa187@gmail.com";

export default function Privacidade() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 24px 96px",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        lineHeight: 1.65,
        color: "#1c1c1e",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Política de Privacidade</h1>
      <p style={{ color: "#6b6b70", marginTop: 0 }}>
        SDR IA · Atualizada em {ATUALIZADO_EM}
      </p>

      <h2>1. Quem somos</h2>
      <p>
        O SDR IA é uma plataforma de prospecção comercial que realiza ligações
        telefônicas conduzidas por agentes de inteligência artificial e envia
        mensagens de acompanhamento pelo WhatsApp Business. Esta política
        descreve como tratamos dados pessoais nessas operações.
      </p>
      <p>
        Para qualquer assunto relacionado a privacidade, o contato é{" "}
        <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
      </p>

      <h2>2. Dados que tratamos</h2>
      <ul>
        <li>
          <strong>Dados de contato do lead:</strong> nome e número de telefone,
          fornecidos pelo cliente que contrata a plataforma.
        </li>
        <li>
          <strong>Registros de ligação:</strong> data, hora, duração, status e —
          quando a gravação está habilitada — o áudio e a transcrição da
          conversa.
        </li>
        <li>
          <strong>Mensagens de WhatsApp:</strong> conteúdo das mensagens
          enviadas e recebidas e seus status de entrega.
        </li>
        <li>
          <strong>Agendamentos:</strong> horários reservados durante a conversa.
        </li>
        <li>
          <strong>Dados de conta:</strong> e-mail e credenciais de acesso dos
          usuários da plataforma.
        </li>
      </ul>
      <p>
        Não coletamos dados sensíveis nem dados de crianças e adolescentes de
        forma intencional.
      </p>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Realizar as ligações e enviar as mensagens solicitadas pelo cliente.</li>
        <li>Agendar reuniões e registrar o resultado de cada contato.</li>
        <li>Operar, manter e melhorar a plataforma.</li>
        <li>Cumprir obrigações legais e responder a solicitações de titulares.</li>
      </ul>
      <p>
        A base legal é o legítimo interesse em prospecção comercial entre
        empresas, o consentimento quando exigido, e a execução de contrato com o
        cliente contratante.
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <p>
        Compartilhamos dados apenas com fornecedores necessários para a operação,
        que atuam como operadores e estão contratualmente obrigados a proteger as
        informações:
      </p>
      <ul>
        <li>
          <strong>Retell AI</strong> — telefonia e agentes de voz.
        </li>
        <li>
          <strong>Meta Platforms (WhatsApp Business Platform)</strong> — envio e
          recebimento de mensagens.
        </li>
        <li>
          <strong>Vercel</strong> — hospedagem da aplicação.
        </li>
        <li>
          <strong>Neon</strong> — banco de dados.
        </li>
      </ul>
      <p>
        Não vendemos dados pessoais e não os cedemos para publicidade de
        terceiros. Podemos divulgar informações quando exigido por lei ou ordem
        judicial.
      </p>

      <h2>5. Transferência internacional</h2>
      <p>
        Alguns fornecedores processam dados fora do Brasil. Nesses casos, a
        transferência ocorre com as salvaguardas previstas na Lei Geral de
        Proteção de Dados.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>
        Mantemos os dados enquanto durar a relação com o cliente contratante e
        pelo prazo necessário para cumprir obrigações legais. Gravações e
        transcrições são eliminadas quando deixam de ser necessárias para a
        finalidade que motivou a coleta, ou antes disso mediante solicitação.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Adotamos medidas técnicas e administrativas para proteger os dados,
        incluindo tráfego criptografado, controle de acesso por autenticação e
        segregação de dados por cliente. Nenhum sistema é totalmente imune a
        incidentes; em caso de violação relevante, comunicaremos os titulares e a
        autoridade competente.
      </p>

      <h2>8. Seus direitos</h2>
      <p>
        Você pode solicitar confirmação de tratamento, acesso, correção,
        anonimização, portabilidade ou eliminação dos seus dados, revogar
        consentimento e se opor a tratamentos feitos com base em legítimo
        interesse. Também pode pedir para não ser mais contatado.
      </p>
      <p>
        Basta escrever para <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
        Respondemos em até 15 dias.
      </p>

      <h2>9. Como parar de receber contatos</h2>
      <p>
        Para sair das listas de prospecção, responda qualquer mensagem de
        WhatsApp pedindo a remoção, informe isso durante a ligação, ou escreva
        para o e-mail acima. A exclusão é aplicada a todas as campanhas.
      </p>

      <h2>10. Exclusão de dados</h2>
      <p>
        Pedidos de exclusão devem ser enviados para{" "}
        <a href={`mailto:${CONTATO}`}>{CONTATO}</a> com o número de telefone ou
        e-mail usado no contato. Removemos os registros associados, salvo aqueles
        que precisamos reter por obrigação legal.
      </p>

      <h2>11. Alterações</h2>
      <p>
        Podemos atualizar esta política. A data de atualização no topo indica a
        versão vigente. Mudanças relevantes serão comunicadas pelos canais
        habituais.
      </p>
    </main>
  );
}
