"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarMoeda } from "@/lib/format";
import type { LicitacaoItem } from "@/lib/licitacoes/types";

const POR_PAGINA = 20;

/** Tabela de itens da licitação com paginação no cliente (licitações têm centenas de itens). */
export function LicitacaoItensTabela({ itens }: { itens: LicitacaoItem[] }) {
  const [pagina, setPagina] = useState(1);

  if (itens.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-muted-foreground">
        Não foi possível carregar os itens desta licitação no PNCP.
      </p>
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * POR_PAGINA;
  const visiveis = itens.slice(inicio, inicio + POR_PAGINA);

  return (
    <>
      <div className="[&_[data-slot=table-container]]:overflow-visible">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8 pl-5">#</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead>Unid.</TableHead>
              <TableHead className="text-right">Vlr. unitário</TableHead>
              <TableHead className="pr-5 text-right">Vlr. total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.map((item) => (
              <TableRow key={item.numeroItem}>
                <TableCell className="pl-5 align-top text-muted-foreground">{item.numeroItem}</TableCell>
                <TableCell className="w-full whitespace-normal align-top leading-snug">{item.descricao}</TableCell>
                <TableCell className="align-top text-right tabular-nums">{item.quantidade ?? "—"}</TableCell>
                <TableCell className="align-top text-muted-foreground">{item.unidadeMedida || "—"}</TableCell>
                <TableCell className="whitespace-nowrap align-top text-right tabular-nums">{formatarMoeda(item.valorUnitarioEstimado)}</TableCell>
                <TableCell className="whitespace-nowrap pr-5 align-top text-right tabular-nums">{formatarMoeda(item.valorTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {inicio + 1}–{Math.min(inicio + POR_PAGINA, itens.length)} de {itens.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina(paginaAtual - 1)}
            >
              Anterior
            </Button>
            <span className="tabular-nums">{paginaAtual}/{totalPaginas}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPagina(paginaAtual + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
