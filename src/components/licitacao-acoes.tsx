"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Scale, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CriarPropostaDialog } from "@/components/criar-proposta-dialog";
import { converterLicitacaoEmCliente, marcarPropostaRecusada } from "@/lib/licitacoes/actions";
import { LicitacaoItem } from "@/lib/licitacoes/types";

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
  temProposta = false,
}: {
  itens: LicitacaoItem[];
  numeroControle: string;
  licitacaoId: string;
  temProposta?: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

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

  function propostaFeita() {
    setErro(null);
    startTransition(async () => {
      try {
        const destino = await converterLicitacaoEmCliente(licitacaoId);
        router.push(destino);
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível transformar a proposta em cliente.");
      }
    });
  }

  function propostaRecusada() {
    setErro(null);
    startTransition(async () => {
      try {
        await marcarPropostaRecusada(licitacaoId);
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível marcar a proposta como recusada.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Ações
      </p>
      <div className="rounded-lg border bg-muted/30 p-2">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Resultado da proposta</p>
        <div className="grid grid-cols-1 gap-2">
          <Button type="button" onClick={propostaFeita} disabled={pendente} className="justify-start">
            {pendente ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Proposta feita
          </Button>
          <Button type="button" variant="outline" onClick={propostaRecusada} disabled={pendente} className="justify-start text-destructive hover:text-destructive">
            {pendente ? <Loader2 className="animate-spin" /> : <XCircle />}
            Proposta recusada
          </Button>
        </div>
        {erro && <p className="mt-2 px-1 text-xs text-destructive">{erro}</p>}
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
