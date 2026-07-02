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

const aspas = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

// Conectores ignorados ao escolher a "primeira palavra significativa" do órgão.
const CONECTORES = new Set(["da", "de", "do", "das", "dos", "e"]);

// Prefixos genéricos de tipo de órgão — pulados para chegar ao nome que identifica
// (ex.: "Comando da Marinha" → "Marinha"; "Prefeitura de Manaus" → "Manaus").
const GENERICOS = new Set([
  "comando", "ministério", "ministerio", "secretaria", "prefeitura", "governo",
  "estado", "município", "municipio", "superintendência", "superintendencia",
  "universidade", "instituto", "fundação", "fundacao", "fundo", "departamento",
  "coordenação", "coordenacao", "gerência", "gerencia", "agência", "agencia",
  "conselho", "câmara", "camara", "tribunal", "empresa", "companhia", "serviço",
  "servico", "diretoria", "federal", "estadual", "municipal", "nacional",
]);

const semAcento = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Remove caracteres inválidos para nome de arquivo (mantém acentos e espaços).
const limparParte = (v: string) => (v ?? "").replace(/[\\/:*?"<>|]/g, "").trim();

/**
 * Palavra que identifica o órgão: pula conectores (da/de/do) e prefixos genéricos
 * de tipo de órgão. Ex.: "Comando da Marinha" → "Marinha".
 * Se tudo for genérico, usa a primeira palavra não-conectora como fallback.
 */
function orgaoResumido(nome: string): string {
  const palavras = (nome ?? "").split(/\s+/).filter(Boolean);
  const relevante = (p: string) => {
    const base = semAcento(p.toLowerCase());
    return !CONECTORES.has(base) && !GENERICOS.has(base);
  };
  const escolhida =
    palavras.find(relevante) ??
    palavras.find((p) => !CONECTORES.has(semAcento(p.toLowerCase()))) ??
    palavras[0] ??
    "orgao";
  return limparParte(escolhida);
}

function paraCsv(itens: LicitacaoItem[]): string {
  const cabecalho = ["Item", "Cód. catálogo", "Descrição", "Descrição completa", "Marcas", "Quantidade", "Unidade"];
  const linhas = itens.map((i) =>
    [
      i.numeroItem,
      i.codigoCatalogo || "-",
      aspas(i.descricao),
      aspas(i.descricaoCompleta || "-"),
      aspas(i.marcas || "-"),
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
  orgao = "",
  uf = "",
  esfera = "",
  arquivosEdital = [],
  temProposta = false,
}: {
  itens: LicitacaoItem[];
  numeroControle: string;
  licitacaoId: string;
  etapa: EtapaSlug;
  orgao?: string;
  uf?: string;
  esfera?: string;
  arquivosEdital?: ArquivoEdital[];
  temProposta?: boolean;
}) {
  const exclusivos = itens.filter(ehExclusivoMeEpp);

  // Nome legível: "<órgão>-<UF>-<esfera>-<abrangência>.csv"
  // (ex.: "Marinha-AM-Federal-Exclusividade MEepp.csv"). Cai no nº de controle
  // do PNCP se o órgão vier vazio, para nunca gerar arquivo sem nome.
  function nomeArquivo(abrangencia: string): string {
    const partes = [orgaoResumido(orgao), uf.toUpperCase(), limparParte(esfera), abrangencia]
      .map(limparParte)
      .filter(Boolean);
    const base = partes.length > 1 ? partes.join("-") : numeroControle.replace(/[^\w]/g, "_");
    return `${base}.csv`;
  }

  function extrairItens(lista: LicitacaoItem[], abrangencia: string) {
    if (lista.length === 0) return;
    const csv = "﻿" + paraCsv(lista); // BOM para acentos no Excel
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo(abrangencia);
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
          <DropdownMenuItem onClick={() => extrairItens(itens, "Todos os itens")}>
            Todas
            <span className="ml-auto text-xs text-muted-foreground">{itens.length}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => extrairItens(exclusivos, "Exclusividade MEepp")}
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
