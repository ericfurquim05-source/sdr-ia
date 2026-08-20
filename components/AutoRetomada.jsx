"use client";

import { useEffect } from "react";

/*
 * REDE DE SEGURANÇA DA FILA
 * Enquanto qualquer pessoa estiver com o Dashboard aberto, esta
 * rotina chama /api/campanhas/processar a cada 30 segundos.
 * Essa rota destrava chamadas penduradas (EM_LIGACAO há 15+ min,
 * caso o webhook da Retell se perca) e preenche as vagas livres.
 * Assim a fila nunca fica parada por falta de aviso.
 */
export default function AutoRetomada() {
  useEffect(() => {
    const tocarFila = () => fetch("/api/campanhas/processar").catch(() => {});
    tocarFila(); // já retoma ao abrir a página
    const timer = setInterval(tocarFila, 30000);
    return () => clearInterval(timer);
  }, []);

  return null; // não renderiza nada
}
