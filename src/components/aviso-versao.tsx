"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const INTERVALO_MS = 60_000;

function avisarNovaVersao() {
  toast("Nova atualização no ar", {
    id: "nova-versao",
    description: "Recarregue a página para usar a versão mais recente.",
    duration: Infinity,
    classNames: {
      toast: "!border-orange-600 !bg-orange-500 !text-white",
      description: "!text-white/90",
      actionButton: "!bg-white !font-medium !text-orange-700",
    },
    action: { label: "Recarregar", onClick: () => window.location.reload() },
  });
}

/** Avisa (laranja) quando uma versão nova do sistema entra no ar: compara a versão que esta aba carregou com a do
 *  servidor. Também cobre a aba antiga que chama ações que não existem mais (x-nextjs-action-not-found). */
export function AvisoVersao() {
  useEffect(() => {
    let versaoDaAba: string | null = null;
    let avisou = false;
    async function conferir() {
      if (avisou || document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/versao", { cache: "no-store" });
        if (!res.ok || !res.headers.get("content-type")?.includes("json")) return; // deploy em andamento ou sessão expirada
        const { versao } = (await res.json()) as { versao?: string };
        if (!versao) return;
        if (versaoDaAba === null) versaoDaAba = versao;
        else if (versao !== versaoDaAba) { avisou = true; avisarNovaVersao(); }
      } catch {
        // servidor reiniciando: tenta na próxima
      }
    }
    void conferir();
    const timer = window.setInterval(conferir, INTERVALO_MS);
    document.addEventListener("visibilitychange", conferir);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", conferir); };
  }, []);

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
