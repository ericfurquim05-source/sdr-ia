import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { clienteLogado, ehAdmin } from "@/lib/auth";
import { saldoAtual } from "@/lib/saldo";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata = {
  title: "SDR IA — Plataforma de prospecção por voz",
  description:
    "SaaS de SDR com inteligência artificial: campanhas de ligação, histórico com gravações, agenda automática e carteira pré-paga por minutagem.",
};

export default async function RootLayout({ children }) {
  // Busca o cliente e o saldo real para a sidebar.
  // Sem banco configurado, a tela continua abrindo em modo demonstração.
  let cliente = null;
  let saldo = 0;
  try {
    cliente = await clienteLogado();
    if (cliente) saldo = await saldoAtual(cliente.id);
  } catch {
    cliente = null;
  }

  return (
    <html lang="pt-BR" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="font-sans">
        {cliente ? (
          <>
            <Sidebar cliente={cliente} saldo={saldo} admin={ehAdmin(cliente)} />
            <main className="pl-16 lg:pl-64">
              <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
            </main>
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
