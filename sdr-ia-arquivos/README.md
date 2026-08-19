# SDR IA — Plataforma de Prospecção por Voz

SaaS de SDR com Inteligência Artificial no modelo **pré-pago (minutagem)**, integrado à **Retell AI**. Interface dark premium construída com **Next.js 14 (App Router) + Tailwind CSS**.

## O que tem dentro

| Aba | O que faz |
| --- | --- |
| **Dashboard** | KPIs do dia (ligações, atendidas, não atendidas, reuniões da IA) + gráfico de conversão semanal |
| **Campanhas** | Upload drag-and-drop de CSV/Excel, escolha obrigatória do agente (Ligação Fria ou Quente) e botão "Executar campanha" |
| **SDR IA** | Histórico de ligações com mini player de áudio, resumo gerado pela IA e transcrição completa |
| **Calendário** | Agenda estilo Google Calendar com horários bloqueados e destaque violeta para reuniões marcadas pela IA |
| **WhatsApp** | Central de conversas pronta para plugar na API oficial do WhatsApp (Meta Cloud API, Z-API, Twilio) |
| **Carteira** | Saldo em destaque, pacotes de R$ 50 / 100 / 500 prontos para gateway de pagamento e extrato |

## Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000. **Sem nenhuma chave configurada, tudo roda em modo demonstração** com dados de exemplo — perfeito para apresentar o produto.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
RETELL_API_KEY=            # chave da API da Retell (painel > API Keys)
RETELL_AGENT_FRIO_ID=      # ID do agente de ligação fria
RETELL_AGENT_QUENTE_ID=    # ID do agente de ligação quente
RETELL_FROM_NUMBER=        # número de saída no formato E.164, ex.: +5511999999999
```

## Publicar grátis na Vercel (passo a passo)

1. **Suba o projeto para o GitHub** — crie um repositório e envie esta pasta (`git init`, `git add .`, `git commit -m "primeira versão"`, `git push`).
2. Acesse **[vercel.com](https://vercel.com)**, faça login com o GitHub e clique em **Add New → Project**.
3. **Importe o repositório**. A Vercel detecta Next.js sozinha — não precisa mudar nada. Clique em **Deploy**.
4. Depois do deploy, vá em **Settings → Environment Variables** e adicione as 4 variáveis do `.env.example`. Clique em **Redeploy** para aplicar.
5. Copie a URL do projeto (ex.: `https://seu-projeto.vercel.app`) e configure o webhook na Retell:

```
https://seu-projeto.vercel.app/api/retell/webhook
```

> Alternativa sem GitHub: instale a CLI com `npm i -g vercel` e rode `npx vercel` na pasta do projeto.

## Onde entram as integrações (comentado no código)

- `app/api/retell/webhook/route.js` → **"Aqui entra o webhook da Retell"**: recebe `call_started`, `call_ended` (gravação, transcrição, duração para debitar minutos) e `call_analyzed` (resumo da IA e reunião agendada → cria evento no calendário).
- `app/api/campanhas/executar/route.js` → dispara as ligações na Retell (`create-phone-call`) escolhendo o agente frio ou quente.
- `app/carteira/page.jsx` → `// TODO`: plugar gateway de pagamento (Mercado Pago, Stripe ou Asaas) nos pacotes.
- `app/whatsapp/page.jsx` → o WhatsApp Web não permite ser embutido em iframe (bloqueio do próprio WhatsApp), então a tela já entrega um chat próprio pronto para conectar na API oficial.

## Estrutura do projeto

```
app/
  page.jsx                 → Dashboard
  campanhas/page.jsx       → Upload + seleção de agente + executar
  sdr-ia/page.jsx          → Histórico com player e transcrições
  calendario/page.jsx      → Agenda com eventos da IA
  whatsapp/page.jsx        → Central de conversas
  carteira/page.jsx        → Saldo, pacotes e extrato
  api/
    retell/webhook/        → Webhook da Retell AI
    campanhas/executar/    → Disparo de campanhas
components/                → Sidebar, KPIs, player de áudio
lib/dados.js               → Dados de demonstração
```

## Próximos passos sugeridos

- Banco de dados (Supabase/Postgres) para persistir ligações, saldo e eventos reais.
- Autenticação de clientes (NextAuth ou Clerk).
- Gateway de pagamento nos pacotes da Carteira.
- Conexão oficial do WhatsApp via Meta Cloud API.
