"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EtapaFiltrada = {
  slug: string;
  nome: string;
  descricao: string;
  quantidade: number;
  conteudo: ReactNode;
};

export function EtapasLicitacaoFilter({ etapas }: { etapas: EtapaFiltrada[] }) {
  const etapaInicial = etapas.find((etapa) => etapa.quantidade > 0)?.slug ?? etapas[0]?.slug;
  const [etapaAtiva, setEtapaAtiva] = useState(etapaInicial);
  const etapaSelecionada = etapas.find((etapa) => etapa.slug === etapaAtiva) ?? etapas[0];

  if (!etapaSelecionada) return null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <div
          role="tablist"
          aria-label="Filtrar licitações por etapa"
          className="grid min-w-[760px] grid-cols-5 gap-2 rounded-xl border bg-muted/35 p-2"
        >
          {etapas.map((etapa) => {
            const selecionada = etapa.slug === etapaSelecionada.slug;

            return (
              <button
                key={etapa.slug}
                type="button"
                role="tab"
                id={`etapa-tab-${etapa.slug}`}
                aria-selected={selecionada}
                aria-controls="etapa-licitacoes-panel"
                onClick={() => setEtapaAtiva(etapa.slug)}
                className={cn(
                  "flex min-h-16 items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selecionada
                    ? "border-primary/35 bg-background text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{etapa.nome}</span>
                  <span className="mt-0.5 block truncate text-xs">{etapa.descricao}</span>
                </span>
                <Badge
                  variant={selecionada ? "default" : "secondary"}
                  className="shrink-0 tabular-nums"
                >
                  {etapa.quantidade}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      <section
        id="etapa-licitacoes-panel"
        role="tabpanel"
        aria-labelledby={`etapa-tab-${etapaSelecionada.slug}`}
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
      >
        <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-semibold">{etapaSelecionada.nome}</h2>
            <p className="truncate text-sm text-muted-foreground">{etapaSelecionada.descricao}</p>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            {etapaSelecionada.quantidade} {etapaSelecionada.quantidade === 1 ? "licitação" : "licitações"}
          </span>
        </header>
        <div className="flex flex-col gap-3 p-3">{etapaSelecionada.conteudo}</div>
      </section>
    </div>
  );
}
