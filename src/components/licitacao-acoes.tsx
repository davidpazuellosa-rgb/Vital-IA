"use client";

import { Download, FileSpreadsheet, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CriarPropostaDialog } from "@/components/criar-proposta-dialog";
import { EtapaSelect } from "@/components/etapa-select";
import { LicitacaoItem, type EtapaSlug } from "@/lib/licitacoes/types";

function paraCsv(itens: LicitacaoItem[]): string {
  const cabecalho = ["Item", "Descrição", "Quantidade", "Unidade", "Valor unitário", "Valor total"];
  const linhas = itens.map((i) =>
    [
      i.numeroItem,
      `"${(i.descricao ?? "").replace(/"/g, '""')}"`,
      i.quantidade ?? "",
      i.unidadeMedida ?? "",
      i.valorUnitarioEstimado ?? "",
      i.valorTotal ?? "",
    ].join(";"),
  );
  return [cabecalho.join(";"), ...linhas].join("\n");
}

export function LicitacaoAcoes({
  itens,
  numeroControle,
  licitacaoId,
  etapa,
  temProposta = false,
}: {
  itens: LicitacaoItem[];
  numeroControle: string;
  licitacaoId: string;
  etapa: EtapaSlug;
  temProposta?: boolean;
}) {
  function extrairItens() {
    const csv = "﻿" + paraCsv(itens); // BOM para acentos no Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itens-${numeroControle.replace(/[^\w]/g, "_")}.csv`;
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
      <Button onClick={extrairItens} disabled={itens.length === 0} className="justify-start">
        <FileSpreadsheet />
        Extrair itens (CSV)
      </Button>
      <CriarPropostaDialog licitacaoId={licitacaoId} temPropostaInicial={temProposta} className="w-full justify-start" />
      <Button variant="outline" disabled className="justify-start">
        <Scale />
        Comparar preços
        <span className="ml-auto text-xs text-muted-foreground">em breve</span>
      </Button>
      <Button variant="outline" disabled className="justify-start">
        <Download />
        Baixar edital
        <span className="ml-auto text-xs text-muted-foreground">em breve</span>
      </Button>
    </div>
  );
}
