export const metadata = {
  title: "Política de Privacidade — SDR IA",
  description:
    "Como a plataforma SDR IA coleta, usa, armazena e protege dados pessoais em campanhas de prospecção por voz e WhatsApp.",
};

/*
 * Página pública de Política de Privacidade.
 * Exigida pela Meta para publicar o app do WhatsApp Business.
 * Precisa responder 200 sem login — liberada no middleware.js.
 */
export default function Privacidade() {
  const atualizado = "20 de agosto de 2026";

  const Secao = ({ titulo, children }) => (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-lg font-semibold text-white">{titulo}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="font-display text-3xl font-bold text-white">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-slate-500">Última atualização: {atualizado}</p>

      <div className="mt-10">
        <Secao titulo="1. Quem somos">
          <p>
            A plataforma SDR IA realiza prospecção comercial ativa por voz e mensagens,
            operada por empresas contratantes que utilizam o serviço para contatar seus
            próprios leads e clientes. Cada empresa contratante é a controladora dos dados
            que insere na plataforma; a SDR IA atua como operadora desses dados.
          </p>
        </Secao>

        <Secao titulo="2. Dados que tratamos">
          <p>Tratamos apenas o necessário para realizar o contato comercial:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>Nome e telefone, fornecidos pela empresa contratante.</li>
            <li>Gravação e transcrição das ligações realizadas.</li>
            <li>Mensagens trocadas por WhatsApp, quando esse canal é utilizado.</li>
            <li>Data, horário, duração e desfecho de cada contato.</li>
            <li>Agendamentos de reunião confirmados durante o atendimento.</li>
          </ul>
          <p>
            Não solicitamos nem armazenamos CPF, CNPJ, dados bancários, senhas, documentos
            ou informações financeiras dos contatados.
          </p>
        </Secao>

        <Secao titulo="3. Para que usamos">
          <p>
            Os dados são usados exclusivamente para realizar o contato comercial, dar
            continuidade ao atendimento iniciado por telefone, agendar reuniões e permitir
            que a empresa contratante acompanhe o histórico das interações. Não vendemos,
            alugamos nem cedemos dados pessoais a terceiros para fins de marketing.
          </p>
        </Secao>

        <Secao titulo="4. WhatsApp">
          <p>
            Quando a empresa contratante utiliza o WhatsApp, as mensagens são enviadas e
            recebidas por meio da API oficial da Meta (WhatsApp Business Platform),
            respeitando as políticas da plataforma. O primeiro contato ocorre por modelo de
            mensagem previamente aprovado pela Meta, sempre relacionado a um atendimento
            iniciado anteriormente. Qualquer pessoa pode solicitar o encerramento do contato
            respondendo à conversa, e a solicitação é atendida imediatamente.
          </p>
        </Secao>

        <Secao titulo="5. Gravação de chamadas">
          <p>
            As ligações são gravadas e transcritas para controle de qualidade e registro do
            atendimento. O interlocutor é informado sobre a natureza automatizada do
            atendimento sempre que questionar, e pode solicitar o encerramento da chamada e
            a exclusão do seu número a qualquer momento.
          </p>
        </Secao>

        <Secao titulo="6. Compartilhamento com terceiros">
          <p>
            Utilizamos provedores de infraestrutura necessários à operação, que tratam dados
            apenas para executar o serviço contratado: Vercel (hospedagem), Neon
            (banco de dados), Retell AI (telefonia e voz), Meta (WhatsApp Business Platform)
            e Anthropic (processamento de linguagem). Não há compartilhamento além do
            necessário para a prestação do serviço.
          </p>
        </Secao>

        <Secao titulo="7. Armazenamento e segurança">
          <p>
            Os dados ficam armazenados em servidores com acesso restrito e protegidos por
            autenticação. Cada empresa contratante acessa somente os próprios dados. Senhas
            são armazenadas de forma criptografada e não podem ser lidas por nós.
          </p>
        </Secao>

        <Secao titulo="8. Seus direitos (LGPD)">
          <p>
            Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode
            solicitar a confirmação do tratamento, o acesso, a correção, a portabilidade, a
            exclusão dos seus dados e a revogação do consentimento, além de se opor ao
            tratamento. Para exercer qualquer desses direitos, entre em contato pelo e-mail
            abaixo — respondemos em até 15 dias.
          </p>
        </Secao>

        <Secao titulo="9. Exclusão de dados">
          <p>
            Para solicitar a exclusão dos seus dados, envie um e-mail informando o número de
            telefone utilizado no contato. A remoção é feita em até 15 dias e abrange
            gravações, transcrições, mensagens e registros associados àquele número.
          </p>
        </Secao>

        <Secao titulo="10. Contato">
          <p>
            Dúvidas sobre esta política ou sobre o tratamento de dados:{" "}
            <a href="mailto:empresasa01@gmail.com" className="text-brand-blue hover:underline">
              empresasa01@gmail.com
            </a>
          </p>
        </Secao>
      </div>

      <p className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-600">
        Esta política pode ser atualizada. A data da última revisão está indicada no topo
        desta página.
      </p>
    </main>
  );
}
