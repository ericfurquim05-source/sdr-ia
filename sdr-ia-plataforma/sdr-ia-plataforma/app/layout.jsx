import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata = {
  title: "SDR IA — Plataforma de prospecção por voz",
  description:
    "SaaS de SDR com inteligência artificial: campanhas de ligação, histórico com gravações, agenda automática e carteira pré-paga por minutagem.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="font-sans">
        <Sidebar />
        <main className="pl-16 lg:pl-64">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
