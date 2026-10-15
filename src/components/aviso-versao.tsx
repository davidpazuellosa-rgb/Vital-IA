"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Depois de uma atualização do sistema, uma aba que ficou aberta chama ações que não existem mais (o servidor responde
 *  com o cabeçalho x-nextjs-action-not-found). Em vez do erro técnico, avisa e oferece recarregar. */
export function AvisoVersao() {
  useEffect(() => {
    const original = window.fetch;
    let avisado = false;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (!avisado && res.status === 404 && res.headers.get("x-nextjs-action-not-found")) {
        avisado = true;
        toast.error("O sistema foi atualizado", {
          id: "versao-antiga",
          description: "Esta página ficou desatualizada. Recarregue para continuar (o que você estava fazendo não foi salvo).",
          duration: Infinity,
          action: { label: "Recarregar", onClick: () => window.location.reload() },
        });
      }
      return res;
    };
    return () => { window.fetch = original; };
  }, []);
  return null;
}
