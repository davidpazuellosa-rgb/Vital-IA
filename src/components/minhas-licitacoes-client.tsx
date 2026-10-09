"use client";

import { useMemo, useState } from "react";
import { ListFilter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EtapasLicitacaoFilter } from "@/components/etapas-licitacao-filter";
import { LicitacoesLista, SeletorVisao, type ItemLista } from "@/components/licitacoes-lista";
import { MultiSelect } from "@/components/multi-select";
import { UF_NOMES } from "@/lib/licitacoes/types";

/* Minhas Licitações: abas por etapa + (abaixo delas) busca, filtros e visão cards/tabela.
 * Os filtros trabalham sobre as licitações já carregadas, então respondem na hora. */

export type ItemMinhas = {
  item: ItemLista;
  etapa: string;
  plataformaId: string;
  temProposta: boolean;
};

type Filtros = {
  ufs: string[];
  modalidades: string[];
  plataformas: string[];
  valorMin: string;
  valorMax: string;
  encerraDe: string;
  encerraAte: string;
  soAlerta: boolean;
  soProposta: boolean;
};

const SEM_FILTROS: Filtros = {
  ufs: [], modalidades: [], plataformas: [], valorMin: "", valorMax: "", encerraDe: "", encerraAte: "", soAlerta: false, soProposta: false,
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function contarFiltros(f: Filtros): number {
  return [
    f.ufs.length > 0, f.modalidades.length > 0, f.plataformas.length > 0,
    f.valorMin !== "" || f.valorMax !== "", f.encerraDe !== "" || f.encerraAte !== "", f.soAlerta, f.soProposta,
  ].filter(Boolean).length;
}

function passa(m: ItemMinhas, busca: string, f: Filtros): boolean {
  const i = m.item;
  if (busca) {
    const palheiro = semAcento([i.titulo, i.orgao, i.municipio, i.uf, i.modalidade, i.plataformaNome, i.numeroControlePNCP ?? ""].join(" "));
    if (!busca.split(/\s+/).every((termo) => palheiro.includes(termo))) return false;
  }
  if (f.ufs.length && !f.ufs.includes(i.uf)) return false;
  if (f.modalidades.length && !f.modalidades.includes(i.modalidade)) return false;
  if (f.plataformas.length && !f.plataformas.includes(m.plataformaId)) return false;
  const valor = i.valorEstimado == null ? null : Number(i.valorEstimado);
  if (f.valorMin !== "" && (valor == null || valor < Number(f.valorMin))) return false;
  if (f.valorMax !== "" && (valor == null || valor > Number(f.valorMax))) return false;
  const encerra = i.dataEncerramento?.slice(0, 10) ?? "";
  if (f.encerraDe && (!encerra || encerra < f.encerraDe)) return false;
  if (f.encerraAte && (!encerra || encerra > f.encerraAte)) return false;
  if (f.soAlerta && !i.salvoPorAlerta) return false;
  if (f.soProposta && !m.temProposta) return false;
  return true;
}

export function MinhasLicitacoesClient({
  etapas,
  itens,
  plataformas,
}: {
  etapas: Array<{ slug: string; nome: string; descricao: string }>;
  itens: ItemMinhas[];
  /** id → nome de exibição de cada plataforma. */
  plataformas: Record<string, string>;
}) {
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);
  const [aberto, setAberto] = useState(false);
  const termo = semAcento(busca.trim());
  const ativos = contarFiltros(filtros);
  const filtrando = termo !== "" || ativos > 0;

  const opcoes = useMemo(() => {
    const ufs = [...new Set(itens.map((m) => m.item.uf).filter(Boolean))].sort();
    const modalidades = [...new Set(itens.map((m) => m.item.modalidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const plats = [...new Set(itens.map((m) => m.plataformaId))];
    return {
      ufs: ufs.map((uf) => ({ value: uf, label: `${uf} · ${UF_NOMES[uf] ?? uf}` })),
      modalidades: modalidades.map((m) => ({ value: m, label: m })),
      plataformas: plats.map((p) => ({ value: p, label: plataformas[p] ?? p })),
    };
  }, [itens, plataformas]);

  const visiveis = useMemo(() => itens.filter((m) => passa(m, termo, filtros)), [itens, termo, filtros]);

  const etapasComConteudo = etapas.map((etapa) => {
    const daEtapa = visiveis.filter((m) => m.etapa === etapa.slug).map((m) => m.item);
    return {
      ...etapa,
      quantidade: daEtapa.length,
      conteudo: daEtapa.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          {filtrando ? "Nenhuma licitação desta etapa com esses filtros." : "Nenhuma licitação nesta etapa."}
        </p>
      ) : (
        <LicitacoesLista itens={daEtapa} />
      ),
    };
  });

  const mudar = <K extends keyof Filtros>(chave: K, valor: Filtros[K]) => setFiltros((f) => ({ ...f, [chave]: valor }));

  const barra = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por objeto, órgão, local ou nº PNCP…"
          aria-label="Pesquisar nas licitações"
          className="pl-9 pr-8"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Limpar pesquisa"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <ListFilter className="size-4" />
            Filtros
            {ativos > 0 && <Badge className="h-5 min-w-5 rounded-full px-1.5 tabular-nums">{ativos}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,26rem)] p-0">
          <div className="flex max-h-[min(80vh,34rem)] flex-col gap-4 overflow-y-auto p-4">
            <div className="flex flex-col gap-1.5">
              <Label>Estado (UF)</Label>
              <MultiSelect options={opcoes.ufs} selected={filtros.ufs} onChange={(v) => mudar("ufs", v)} placeholder="Todos os estados" plural="estados" searchable />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Modalidade</Label>
              <MultiSelect options={opcoes.modalidades} selected={filtros.modalidades} onChange={(v) => mudar("modalidades", v)} placeholder="Todas as modalidades" plural="modalidades" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Plataforma</Label>
              <MultiSelect options={opcoes.plataformas} selected={filtros.plataformas} onChange={(v) => mudar("plataformas", v)} placeholder="Todas as plataformas" plural="plataformas" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Valor mínimo (R$)</Label>
                <Input type="number" min={0} value={filtros.valorMin} onChange={(e) => mudar("valorMin", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Valor máximo (R$)</Label>
                <Input type="number" min={0} value={filtros.valorMax} onChange={(e) => mudar("valorMax", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Encerra a partir de</Label>
                <Input type="date" value={filtros.encerraDe} onChange={(e) => mudar("encerraDe", e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Encerra até</Label>
                <Input type="date" value={filtros.encerraAte} onChange={(e) => mudar("encerraAte", e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={filtros.soAlerta} onCheckedChange={(v) => mudar("soAlerta", v === true)} />
                Só as salvas por alerta
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox checked={filtros.soProposta} onCheckedChange={(v) => mudar("soProposta", v === true)} />
                Só as que já têm proposta (rascunho ou enviada)
              </label>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{visiveis.length}</span> de {itens.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={ativos === 0} onClick={() => setFiltros(SEM_FILTROS)}>Limpar</Button>
              <Button size="sm" onClick={() => setAberto(false)}>Ver resultados</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {filtrando && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setBusca(""); setFiltros(SEM_FILTROS); }}>
          <X className="size-3.5" /> Limpar tudo
        </Button>
      )}

      <SeletorVisao className="ml-auto" />
    </div>
  );

  return <EtapasLicitacaoFilter etapas={etapasComConteudo} barra={barra} />;
}
