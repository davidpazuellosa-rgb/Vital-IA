"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Bell, Columns3, ExternalLink, LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/* ------------------------------------- colunas da tabela ------------------------------------- */

type ColunaId = "orgao" | "local" | "modalidade" | "valor" | "abertura" | "encerra" | "plataforma" | "situacao";

const CHAVE_COLUNAS = "vitalia:colunas-licitacoes";
/** Ordem de exibição; "orgao" é a linha abaixo do título (não uma coluna própria). */
const COLUNAS: Array<{ id: ColunaId; rotulo: string; padrao: boolean }> = [
  { id: "orgao", rotulo: "Órgão (abaixo do título)", padrao: true },
  { id: "local", rotulo: "Local", padrao: true },
  { id: "modalidade", rotulo: "Modalidade", padrao: true },
  { id: "valor", rotulo: "Valor", padrao: true },
  { id: "abertura", rotulo: "Abertura", padrao: true },
  { id: "encerra", rotulo: "Encerra", padrao: true },
  { id: "plataforma", rotulo: "Plataforma", padrao: false },
  { id: "situacao", rotulo: "Situação", padrao: false },
];
const PADRAO_COLUNAS = COLUNAS.filter((c) => c.padrao).map((c) => c.id);

function lerColunasBruto(): string {
  try {
    return localStorage.getItem(CHAVE_COLUNAS) ?? "";
  } catch {
    return "";
  }
}

function useColunas(): [Set<ColunaId>, (ids: ColunaId[]) => void] {
  const bruto = useSyncExternalStore(assinar, lerColunasBruto, () => "");
  const visiveis = useMemo(() => {
    try {
      const lista: unknown = JSON.parse(bruto);
      if (Array.isArray(lista)) return new Set(COLUNAS.map((c) => c.id).filter((id) => lista.includes(id)));
    } catch { /* sem escolha salva: usa o padrão */ }
    return new Set(PADRAO_COLUNAS);
  }, [bruto]);
  const definir = (ids: ColunaId[]) => {
    try { localStorage.setItem(CHAVE_COLUNAS, JSON.stringify(ids)); } catch { /* armazenamento indisponível */ }
    ouvintes.forEach((o) => o());
  };
  return [visiveis, definir];
}

function SeletorColunas() {
  const [visiveis, definir] = useColunas();
  const alternar = (id: ColunaId) => definir(COLUNAS.map((c) => c.id).filter((c) => (c === id ? !visiveis.has(c) : visiveis.has(c))));
  const ehPadrao = visiveis.size === PADRAO_COLUNAS.length && PADRAO_COLUNAS.every((id) => visiveis.has(id));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Columns3 className="size-3.5" />
          Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0">
        <p className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Colunas visíveis</p>
        <div className="flex flex-col p-1.5">
          <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
            <Checkbox checked disabled /> Licitação
          </label>
          {COLUNAS.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
              <Checkbox checked={visiveis.has(c.id)} onCheckedChange={() => alternar(c.id)} />
              {c.rotulo}
            </label>
          ))}
          <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
            <Checkbox checked disabled /> Ações
          </label>
        </div>
        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={ehPadrao} onClick={() => definir(PADRAO_COLUNAS)}>
            Restaurar padrão
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SeletorVisao({ className }: { className?: string }) {
  const [visao, definir] = useVisao();
  const opcoes: Array<{ id: Visao; rotulo: string; icone: typeof LayoutGrid }> = [
    { id: "cards", rotulo: "Cards", icone: LayoutGrid },
    { id: "tabela", rotulo: "Tabela", icone: Table2 },
  ];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {visao === "tabela" && <SeletorColunas />}
      <div role="group" aria-label="Modo de visualização" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
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
    </div>
  );
}

/** `acaoTabela`: ações da visão em tabela, quando diferem das dos cards (ex.: sem o botão de proposta). */
export type ItemLista = LicitacaoCardProps & { id: string; acaoTabela?: ReactNode };

export function LicitacoesLista({ itens }: { itens: ItemLista[] }) {
  const [visao] = useVisao();
  if (visao === "tabela") return <TabelaLicitacoes itens={itens} />;
  return (
    <>
      {itens.map(({ id, acaoTabela, ...props }) => {
        void acaoTabela;
        return <LicitacaoCard key={id} {...props} />;
      })}
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

const CAB = "h-9 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

/** Colunas de dados (além de Licitação e Ações), na ordem de exibição. */
const CELULAS: Record<Exclude<ColunaId, "orgao">, { rotulo: string; cab?: string; cel?: (i: ItemLista) => string; render: (i: ItemLista) => ReactNode }> = {
  local: { rotulo: "Local", render: (i) => `${i.municipio || "—"} / ${i.uf || "—"}` },
  modalidade: { rotulo: "Modalidade", cel: () => "max-w-[9.5rem] truncate", render: (i) => i.modalidade || "—" },
  valor: {
    rotulo: "Valor",
    cab: "text-right",
    cel: (i) => cn("text-right tabular-nums", !(i.valorEstimado != null && Number(i.valorEstimado) > 0) && "text-muted-foreground"),
    render: (i) => (i.valorEstimado != null && Number(i.valorEstimado) > 0 ? formatarMoeda(i.valorEstimado) : "—"),
  },
  abertura: { rotulo: "Abertura", cel: () => "tabular-nums text-muted-foreground", render: (i) => dataCurta(i.dataAbertura) },
  encerra: { rotulo: "Encerra", cel: () => "font-medium tabular-nums text-primary", render: (i) => dataCurta(i.dataEncerramento) },
  plataforma: { rotulo: "Plataforma", cel: () => "text-muted-foreground", render: (i) => i.plataformaNome.replace(/ \(.*\)$/, "") },
  situacao: { rotulo: "Situação", cel: () => "max-w-[11rem] truncate text-muted-foreground", render: (i) => i.situacao || "—" },
};

function TabelaLicitacoes({ itens }: { itens: ItemLista[] }) {
  const [visiveis] = useColunas();
  const colunas = COLUNAS.filter((c): c is (typeof COLUNAS)[number] & { id: Exclude<ColunaId, "orgao"> } => c.id !== "orgao" && visiveis.has(c.id));
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table className="text-[13px]">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className={CAB}>Licitação</TableHead>
            {colunas.map((c) => (
              <TableHead key={c.id} className={cn(CAB, CELULAS[c.id].cab)}>{CELULAS[c.id].rotulo}</TableHead>
            ))}
            <TableHead className="h-9 w-px px-3" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((i) => {
            const portal = linkPncp(i.numeroControlePNCP);
            const externo = portal ?? i.linkOrigem;
            return (
              <TableRow key={i.id} className="group">
                <TableCell className="w-full min-w-56 max-w-0 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {i.href ? (
                      <Link href={i.href} title={i.titulo} className="truncate font-medium leading-tight hover:text-primary hover:underline">{i.titulo}</Link>
                    ) : (
                      <span title={i.titulo} className="truncate font-medium leading-tight">{i.titulo}</span>
                    )}
                    {i.salvoPorAlerta && <Bell className="size-3 shrink-0 text-primary" aria-label="Salva por alerta" />}
                  </div>
                  {visiveis.has("orgao") && (
                    <p title={i.orgao} className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{i.orgao}</p>
                  )}
                </TableCell>
                {colunas.map((c) => {
                  const col = CELULAS[c.id];
                  return (
                    <TableCell key={c.id} className={cn("px-3 py-2", col.cel?.(i))} title={c.id === "modalidade" || c.id === "situacao" ? col.render(i)?.toString() : undefined}>
                      {col.render(i)}
                    </TableCell>
                  );
                })}
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
                    <div className={ACOES_COMPACTAS}>{i.acaoTabela ?? i.action}</div>
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
