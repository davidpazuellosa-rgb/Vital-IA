"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVita } from "./vita-contexto";

/** Botão da Vita no canto direito da top bar. */
export function VitaBotao() {
  const { aberto, alternar } = useVita();
  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={aberto}
      aria-label={aberto ? "Fechar a Vita" : "Abrir a Vita"}
      title="Vita · ⌘J"
      className={cn(
        "group/vita relative ml-auto inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-full border px-3 text-sm font-medium transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        aberto
          ? "border-primary/40 bg-primary text-primary-foreground shadow-sm shadow-primary/30"
          : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
      )}
    >
      <Sparkles
        className={cn(
          "size-4 transition-transform duration-500",
          aberto ? "rotate-12 text-primary-foreground" : "text-primary group-hover/vita:rotate-12",
        )}
      />
      <span>Vita</span>
    </button>
  );
}
