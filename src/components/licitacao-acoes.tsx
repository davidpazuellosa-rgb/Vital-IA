"use client";

import { ChevronDown, FileSpreadsheet, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CriarPropostaDialog } from "@/components/criar-proposta-dialog";
import { EtapaSelect } from "@/components/etapa-select";
import { BaixarEditalButton } from "@/components/baixar-edital-button";
import { ehExclusivoMeEpp, LicitacaoItem, type EtapaSlug } from "@/lib/licitacoes/types";

type ArquivoEdital = { titulo: string; url: string };

function paraCsv(itens: LicitacaoItem[]): string {
  const cabecalho = ["Item", "Cód. catálogo", "Descrição", "Quantidade", "Unidade"];
  const linhas = itens.map((i) =>
    [
      i.numeroItem,
      i.codigoCatalogo || "",
      `"${(i.descricao ?? "").replace(/"/g, '""')}"`,
      i.quantidade ?? "",
      i.unidadeMedida ?? "",
    ].join(";"),
  );
  return [cabecalho.join(";"), ...linhas].join("\n");
}

export function LicitacaoAcoes({
  itens,
  numeroControle,
  licitacaoId,
  etapa,
  arquivosEdital = [],
  temProposta = false,
}: {
  itens: LicitacaoItem[];
  numeroControle: string;
  licitacaoId: string;
  etapa: EtapaSlug;
  arquivosEdital?: ArquivoEdital[];
  temProposta?: boolean;
}) {
  const exclusivos = itens.filter(ehExclusivoMeEpp);

  function extrairItens(lista: LicitacaoItem[], sufixo = "") {
    if (lista.length === 0) return;
    const csv = "﻿" + paraCsv(lista); // BOM para acentos no Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itens${sufixo}-${numeroControle.replace(/[^\w]/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ações
      </p>
      <div className="rounded-lg border bg-muted/30 p-2">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Situação na pipeline</p>
        <EtapaSelect id={licitacaoId} etapa={etapa} size="default" className="w-full" />
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Ao marcar &ldquo;Vencida&rdquo;, a licitação vira um cliente automaticamente.
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={itens.length === 0} className="justify-start">
            <FileSpreadsheet />
            Extrair itens (CSV)
            <ChevronDown className="ml-auto" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => extrairItens(itens)}>
            Todas
            <span className="ml-auto text-xs text-muted-foreground">{itens.length}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => extrairItens(exclusivos, "-me-epp")}
            disabled={exclusivos.length === 0}
          >
            Exclusividade ME/EPP
            <span className="ml-auto text-xs text-muted-foreground">{exclusivos.length}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CriarPropostaDialog licitacaoId={licitacaoId} temPropostaInicial={temProposta} className="w-full justify-start" />
      <Button variant="outline" disabled className="justify-start">
        <Scale />
        Comparar preços
        <span className="ml-auto text-xs text-muted-foreground">em breve</span>
      </Button>
      <BaixarEditalButton numeroControle={numeroControle} disponivel={arquivosEdital.length > 0} />
    </div>
  );
}
