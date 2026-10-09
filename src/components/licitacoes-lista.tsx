"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ExternalLink, LayoutGrid, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LicitacaoCard, type LicitacaoCardProps } from "@/components/licitacao-card";
import { formatarData, formatarMoeda } from "@/lib/format";
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

function TabelaLicitacoes({ itens }: { itens: ItemLista[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table className="min-w-[1000px]">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[38%]">Licitação</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Modalidade</TableHead>
            <TableHead className="text-right">Valor estimado</TableHead>
            <TableHead>Abertura</TableHead>
            <TableHead>Encerramento</TableHead>
            <TableHead className="w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((i) => {
            const externo = linkPncp(i.numeroControlePNCP) ?? i.linkOrigem;
            const titulo = i.href ? (
              <Link href={i.href} className="font-medium leading-snug hover:text-primary hover:underline">{i.titulo}</Link>
            ) : (
              <span className="font-medium leading-snug">{i.titulo}</span>
            );
            return (
              <TableRow key={i.id}>
                <TableCell className="whitespace-normal align-top">
                  <div className="flex flex-col gap-1">
                    {titulo}
                    <span className="text-xs text-muted-foreground">{i.orgao}</span>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="secondary" className="font-normal">{i.plataformaNome}</Badge>
                      {i.situacao && <Badge variant="outline" className="font-normal">{i.situacao}</Badge>}
                      {i.salvoPorAlerta && (
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">Salvo alerta</Badge>
                      )}
                      {externo && (
                        <a href={externo} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          {linkPncp(i.numeroControlePNCP) ? "PNCP" : "Origem"}
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="align-top whitespace-nowrap">{`${i.municipio || "—"} / ${i.uf || "—"}`}</TableCell>
                <TableCell className="align-top whitespace-normal">{i.modalidade || "—"}</TableCell>
                <TableCell className="text-right align-top whitespace-nowrap tabular-nums">{formatarMoeda(i.valorEstimado)}</TableCell>
                <TableCell className="align-top whitespace-nowrap tabular-nums">{formatarData(i.dataAbertura)}</TableCell>
                <TableCell className="align-top whitespace-nowrap font-medium tabular-nums text-primary">{formatarData(i.dataEncerramento)}</TableCell>
                <TableCell className="align-top">{i.action}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
