"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Bell, ExternalLink, LayoutGrid, Table2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LicitacaoCard, type LicitacaoCardProps } from "@/components/licitacao-card";
import { formatarMoeda } from "@/lib/format";
import { linkPncp } from "@/lib/licitacoes/pncp-url";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------------------------
 * Visão das listas de licitações: cards ou tabela. A escolha vale para Busca e Minhas Licitações
 * e fica guardada no navegador (useSyncExternalStore: sem divergência entre servidor e cliente).
 * ------------------------------------------------------------------------------------------- */

type Visao = "cards" | "tabela";
const CHAVE = "vitalia:visao-licitacoes";
const ouvintes = new Set<() => void>();

function lerVisao(): Visao {
  try {
    return localStorage.getItem(CHAVE) === "tabela" ? "tabela" : "cards";
  } catch {
    return "cards";
  }
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  window.addEventListener("storage", avisar);
  return () => {
    ouvintes.delete(avisar);
    window.removeEventListener("storage", avisar);
  };
}

function useVisao(): [Visao, (v: Visao) => void] {
  const visao = useSyncExternalStore(assinar, lerVisao, () => "cards" as Visao);
  const definir = (v: Visao) => {
    try { localStorage.setItem(CHAVE, v); } catch { /* armazenamento indisponível */ }
    ouvintes.forEach((o) => o());
  };
  return [visao, definir];
}

export function SeletorVisao({ className }: { className?: string }) {
  const [visao, definir] = useVisao();
  const opcoes: Array<{ id: Visao; rotulo: string; icone: typeof LayoutGrid }> = [
    { id: "cards", rotulo: "Cards", icone: LayoutGrid },
    { id: "tabela", rotulo: "Tabela", icone: Table2 },
  ];
  return (
    <div role="group" aria-label="Modo de visualização" className={cn("inline-flex rounded-lg border bg-muted/40 p-0.5", className)}>
      {opcoes.map(({ id, rotulo, icone: Icone }) => (
        <button
          key={id}
          type="button"
          aria-pressed={visao === id}
          onClick={() => definir(id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            visao === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icone className="size-3.5" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export type ItemLista = LicitacaoCardProps & { id: string };

export function LicitacoesLista({ itens }: { itens: ItemLista[] }) {
  const [visao] = useVisao();
  if (visao === "tabela") return <TabelaLicitacoes itens={itens} />;
  return (
    <>
      {itens.map(({ id, ...props }) => (
        <LicitacaoCard key={id} {...props} />
      ))}
    </>
  );
}

/** Data curta (dd/mm/aa) para a tabela ficar enxuta. */
const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

/** Botões de ação em tamanho de tabela: ícones sem rótulo (os botões têm título) e etapa mais estreita. */
const ACOES_COMPACTAS = cn(
  "flex items-center justify-end gap-1",
  "[&_button]:!h-7 [&_button:not([data-slot=select-trigger])]:!px-2 [&_button:not([data-slot=select-trigger])>span]:hidden",
  "[&_[data-slot=select-trigger]]:!h-7 [&_[data-slot=select-trigger]]:!w-[7.75rem] [&_[data-slot=select-trigger]]:!px-2",
);

function TabelaLicitacoes({ itens }: { itens: ItemLista[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table className="min-w-[840px] text-[13px]">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            {["Licitação", "Local", "Modalidade"].map((t) => (
              <TableHead key={t} className="h-9 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t}</TableHead>
            ))}
            <TableHead className="h-9 px-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Valor</TableHead>
            <TableHead className="h-9 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Abertura</TableHead>
            <TableHead className="h-9 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Encerra</TableHead>
            <TableHead className="h-9 w-px px-3" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((i) => {
            const portal = linkPncp(i.numeroControlePNCP);
            const externo = portal ?? i.linkOrigem;
            const valor = i.valorEstimado != null && Number(i.valorEstimado) > 0 ? formatarMoeda(i.valorEstimado) : null;
            return (
              <TableRow key={i.id} className="group">
                <TableCell className="w-full max-w-0 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {i.href ? (
                      <Link href={i.href} title={i.titulo} className="truncate font-medium leading-tight hover:text-primary hover:underline">{i.titulo}</Link>
                    ) : (
                      <span title={i.titulo} className="truncate font-medium leading-tight">{i.titulo}</span>
                    )}
                    {i.salvoPorAlerta && <Bell className="size-3 shrink-0 text-primary" aria-label="Salva por alerta" />}
                  </div>
                  <p title={i.orgao} className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{i.orgao}</p>
                </TableCell>
                <TableCell className="px-3 py-2" title={i.situacao || undefined}>
                  <p className="leading-tight">{`${i.municipio || "—"} / ${i.uf || "—"}`}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{i.plataformaNome.replace(/ \(.*\)$/, "")}</p>
                </TableCell>
                <TableCell className="max-w-[9.5rem] truncate px-3 py-2" title={i.modalidade || undefined}>{i.modalidade || "—"}</TableCell>
                <TableCell className={cn("px-3 py-2 text-right tabular-nums", !valor && "text-muted-foreground")}>{valor ?? "—"}</TableCell>
                <TableCell className="px-3 py-2 tabular-nums text-muted-foreground">{dataCurta(i.dataAbertura)}</TableCell>
                <TableCell className="px-3 py-2 font-medium tabular-nums text-primary">{dataCurta(i.dataEncerramento)}</TableCell>
                <TableCell className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {externo && (
                      <a
                        href={externo}
                        target="_blank"
                        rel="noreferrer"
                        title={portal ? "Ver no PNCP" : "Ver no sistema de origem"}
                        aria-label={portal ? "Ver no PNCP" : "Ver no sistema de origem"}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    <div className={ACOES_COMPACTAS}>{i.action}</div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
