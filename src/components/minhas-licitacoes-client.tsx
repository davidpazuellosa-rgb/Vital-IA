"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ListFilter, Search, X } from "lucide-react";
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
  /** Empresa dona da licitação (slug em src/lib/empresas.ts). */
  empresa: string;
  /** Quando a licitação foi salva e quando a proposta foi enviada (ISO), para ordenar. */
  salvaEm: string | null;
  enviadaEm: string | null;
  temProposta: boolean;
};

type Filtros = {
  empresas: string[];
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

/* ---------------------------------------- ordenação ---------------------------------------- */
type Campo = "salva" | "encerramento" | "envio" | "abertura" | "valor" | "titulo" | "orgao";
type Dir = "asc" | "desc";
type Ordem = { campo: Campo; dir: Dir };

const ORDEM_PADRAO: Ordem = { campo: "salva", dir: "desc" };
const CHAVE_ORDEM = "vitalia:ordem-minhas-licitacoes";

const CAMPOS: Array<{ campo: Campo; rotulo: string; dirPadrao: Dir; asc: string; desc: string }> = [
  { campo: "salva", rotulo: "Salvas em", dirPadrao: "desc", asc: "Mais antigas primeiro", desc: "Mais recentes primeiro" },
  { campo: "encerramento", rotulo: "Encerramento das propostas", dirPadrao: "asc", asc: "Mais próximo primeiro", desc: "Mais distante primeiro" },
  { campo: "envio", rotulo: "Envio da proposta", dirPadrao: "desc", asc: "Mais antigo primeiro", desc: "Mais recente primeiro" },
  { campo: "abertura", rotulo: "Abertura", dirPadrao: "asc", asc: "Mais próxima primeiro", desc: "Mais distante primeiro" },
  { campo: "valor", rotulo: "Valor estimado", dirPadrao: "desc", asc: "Menor primeiro", desc: "Maior primeiro" },
  { campo: "titulo", rotulo: "Objeto (A–Z)", dirPadrao: "asc", asc: "A → Z", desc: "Z → A" },
  { campo: "orgao", rotulo: "Órgão (A–Z)", dirPadrao: "asc", asc: "A → Z", desc: "Z → A" },
];

function valorDe(m: ItemMinhas, campo: Campo): string | number | null {
  const i = m.item;
  switch (campo) {
    case "salva": return m.salvaEm;
    case "encerramento": return i.dataEncerramento;
    case "envio": return m.enviadaEm;
    case "abertura": return i.dataAbertura;
    case "valor": return i.valorEstimado == null ? null : Number(i.valorEstimado);
    case "titulo": return i.titulo ? semAcento(i.titulo) : null;
    case "orgao": return i.orgao ? semAcento(i.orgao) : null;
  }
}

/** Ordena sem mexer na lista original; quem não tem o dado (ex.: proposta nunca enviada) vai sempre para o fim. */
function ordenar(lista: ItemMinhas[], o: Ordem): ItemMinhas[] {
  const sinal = o.dir === "asc" ? 1 : -1;
  return [...lista].sort((a, b) => {
    const x = valorDe(a, o.campo), y = valorDe(b, o.campo);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR")) * sinal;
  });
}

const ouvintesOrdem = new Set<() => void>();
let ordemEmMemoria = ""; // se o navegador não deixar usar localStorage, vale só até recarregar
const lerOrdemBruta = () => { try { return localStorage.getItem(CHAVE_ORDEM) ?? ordemEmMemoria; } catch { return ordemEmMemoria; } };
function assinarOrdem(avisar: () => void) {
  ouvintesOrdem.add(avisar);
  window.addEventListener("storage", avisar);
  return () => { ouvintesOrdem.delete(avisar); window.removeEventListener("storage", avisar); };
}
function lerOrdem(bruto: string): Ordem {
  try {
    const o = JSON.parse(bruto || "null") as Ordem | null;
    if (o && CAMPOS.some((c) => c.campo === o.campo) && (o.dir === "asc" || o.dir === "desc")) return o;
  } catch { /* valor inválido: usa o padrão */ }
  return ORDEM_PADRAO;
}
function salvarOrdem(o: Ordem) {
  ordemEmMemoria = JSON.stringify(o);
  try { localStorage.setItem(CHAVE_ORDEM, ordemEmMemoria); } catch { /* sem armazenamento */ }
  ouvintesOrdem.forEach((f) => f());
}

const SEM_FILTROS: Filtros = {
  empresas: [], ufs: [], modalidades: [], plataformas: [], valorMin: "", valorMax: "", encerraDe: "", encerraAte: "", soAlerta: false, soProposta: false,
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function contarFiltros(f: Filtros): number {
  return [
    f.empresas.length > 0, f.ufs.length > 0, f.modalidades.length > 0, f.plataformas.length > 0,
    f.valorMin !== "" || f.valorMax !== "", f.encerraDe !== "" || f.encerraAte !== "", f.soAlerta, f.soProposta,
  ].filter(Boolean).length;
}

function passa(m: ItemMinhas, busca: string, f: Filtros): boolean {
  const i = m.item;
  if (busca) {
    const palheiro = semAcento([i.titulo, i.orgao, i.municipio, i.uf, i.modalidade, i.plataformaNome, i.empresaNome ?? "", i.numeroControlePNCP ?? ""].join(" "));
    if (!busca.split(/\s+/).every((termo) => palheiro.includes(termo))) return false;
  }
  if (f.empresas.length && !f.empresas.includes(m.empresa)) return false;
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
  empresasDisponiveis,
}: {
  etapas: Array<{ slug: string; nome: string; descricao: string }>;
  itens: ItemMinhas[];
  /** Empresas que a pessoa enxerga (vem da lista de empresas do sistema: empresa nova aparece sozinha). */
  empresasDisponiveis: Array<{ slug: string; nome: string }>;
  /** id → nome de exibição de cada plataforma. */
  plataformas: Record<string, string>;
}) {
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);
  const [aberto, setAberto] = useState(false);
  const [abertoOrdem, setAbertoOrdem] = useState(false);
  // a escolha fica guardada neste navegador (useSyncExternalStore: servidor e cliente começam iguais)
  const ordemBruta = useSyncExternalStore(assinarOrdem, lerOrdemBruta, () => "");
  const ordem = useMemo(() => lerOrdem(ordemBruta), [ordemBruta]);
  const escolherOrdem = salvarOrdem;
  const termo = semAcento(busca.trim());
  const ativos = contarFiltros(filtros);
  const filtrando = termo !== "" || ativos > 0;

  const opcoes = useMemo(() => {
    const ufs = [...new Set(itens.map((m) => m.item.uf).filter(Boolean))].sort();
    const modalidades = [...new Set(itens.map((m) => m.item.modalidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const plats = [...new Set(itens.map((m) => m.plataformaId))];
    // empresas do sistema que a pessoa enxerga + qualquer outra que apareça nas licitações
    const empresas = [...empresasDisponiveis, ...[...new Set(itens.map((m) => m.empresa))].filter((s) => !empresasDisponiveis.some((e) => e.slug === s)).map((s) => ({ slug: s, nome: s }))];
    return {
      empresas: empresas.map((e) => ({ value: e.slug, label: e.nome })),
      ufs: ufs.map((uf) => ({ value: uf, label: `${uf} · ${UF_NOMES[uf] ?? uf}` })),
      modalidades: modalidades.map((m) => ({ value: m, label: m })),
      plataformas: plats.map((p) => ({ value: p, label: plataformas[p] ?? p })),
    };
  }, [itens, plataformas, empresasDisponiveis]);

  const visiveis = useMemo(() => ordenar(itens.filter((m) => passa(m, termo, filtros)), ordem), [itens, termo, filtros, ordem]);

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
            {opcoes.empresas.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label>Empresa</Label>
                <MultiSelect options={opcoes.empresas} selected={filtros.empresas} onChange={(v) => mudar("empresas", v)} placeholder="Todas as empresas" plural="empresas" />
              </div>
            )}
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

      <Popover open={abertoOrdem} onOpenChange={setAbertoOrdem}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <ArrowUpDown className="size-4" />
            Ordenar
            {(ordem.campo !== ORDEM_PADRAO.campo || ordem.dir !== ORDEM_PADRAO.dir) && <span className="size-2 rounded-full bg-primary" aria-label="Ordem alterada" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,22rem)] p-2">
          <ul className="flex flex-col">
            {CAMPOS.map((c) => {
              const ativo = ordem.campo === c.campo;
              return (
                <li key={c.campo}>
                  <button
                    type="button"
                    onClick={() => escolherOrdem(ativo ? { campo: c.campo, dir: ordem.dir === "asc" ? "desc" : "asc" } : { campo: c.campo, dir: c.dirPadrao })}
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center">{ativo && <Check className="size-4 text-primary" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={ativo ? "font-medium" : ""}>{c.rotulo}</span>
                      {ativo && <span className="block text-xs text-muted-foreground">{ordem.dir === "asc" ? c.asc : c.desc}</span>}
                    </span>
                    {ativo && (ordem.dir === "asc" ? <ArrowUp className="size-4 text-muted-foreground" /> : <ArrowDown className="size-4 text-muted-foreground" />)}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t px-2 pt-2">
            <span className="text-xs text-muted-foreground">Clique de novo para inverter</span>
            <Button variant="ghost" size="sm" disabled={ordem.campo === ORDEM_PADRAO.campo && ordem.dir === ORDEM_PADRAO.dir} onClick={() => escolherOrdem(ORDEM_PADRAO)}>Padrão</Button>
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
