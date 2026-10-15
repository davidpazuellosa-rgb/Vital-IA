"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Card "Documentos vencidos": clicar abre o grupo do documento vencido, rola até ele e o destaca. Vários: cada clique vai ao próximo. */
export function CardVencidos({ ids }: { ids: string[] }) {
  const [vez, setVez] = useState(0);
  const n = ids.length;

  function ir() {
    const id = ids[vez % n];
    const el = document.querySelector<HTMLElement>(`[data-doc-id="${CSS.escape(id)}"]`);
    if (!el) return;
    for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true; // abre o grupo
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const destaque = ["ring-2", "ring-destructive", "ring-offset-2", "ring-offset-background"];
    el.classList.add(...destaque);
    setTimeout(() => el.classList.remove(...destaque), 2600);
    setVez((v) => v + 1);
  }

  const conteudo = (
    <Card className={`shadow-sm ${n ? "transition-colors hover:border-destructive/40 hover:bg-destructive/5" : ""}`}>
      <CardContent className="flex flex-col gap-1 py-1">
        <span className="flex items-center justify-between text-xs text-muted-foreground">
          Documentos vencidos
          {n > 0 && <span className="inline-flex items-center gap-1 text-destructive">{n > 1 ? `${(vez % n) + 1} de ${n}` : "Ver"} <ArrowRight className="size-3" /></span>}
        </span>
        <span className={`text-xl font-semibold ${n ? "text-destructive" : ""}`}>{n}</span>
      </CardContent>
    </Card>
  );
  return n ? <button type="button" onClick={ir} className="rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={`Ver o documento vencido (${n})`}>{conteudo}</button> : conteudo;
}
