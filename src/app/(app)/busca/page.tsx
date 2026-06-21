"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

const ESTADO_BUSCA_KEY = "vitalia:busca:estado";
import {
  Loader2,
  Search,
  BookmarkPlus,
  Check,
  SlidersHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  SearchX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiToggle } from "@/components/multi-toggle";
import { LicitacaoCard } from "@/components/licitacao-card";
import { MODALIDADES, PLATAFORMAS, PlatformId, UFS, UnifiedLicitacao, UniversalFilter } from "@/lib/licitacoes/types";
import { salvarLicitacao } from "@/lib/licitacoes/actions";
import { cn } from "@/lib/utils";

const PLATAFORMA_NOME: Record<string, string> = Object.fromEntries(
  PLATAFORMAS.map((p) => [p.id, p.nome]),
);

function dataPadrao(diasAtras: number): string {
  const data = new Date();
  data.setDate(data.getDate() - diasAtras);
  return data.toISOString().slice(0, 10);
}

export default function BuscaPage() {
  const [keyword, setKeyword] = useState("");
  const [orgao, setOrgao] = useState("");
  const [ufs, setUfs] = useState<string[]>([]);
  const [modalidades, setModalidades] = useState<string[]>([]);
  const [dataInicial, setDataInicial] = useState(dataPadrao(30));
  const [dataFinal, setDataFinal] = useState(dataPadrao(0));
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [plataformas, setPlataformas] = useState<string[]>(["pncp"]);
  const [apenasAberto, setApenasAberto] = useState(true);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [resultados, setResultados] = useState<UnifiedLicitacao[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscou, setBuscou] = useState(false);
  const [salvas, setSalvas] = useState<Set<string>>(new Set());
  const [, salvarTransition] = useTransition();

  const filtrosAtivos =
    (keyword ? 1 : 0) +
    (orgao ? 1 : 0) +
    ufs.length +
    modalidades.length +
    (valorMin ? 1 : 0) +
    (valorMax ? 1 : 0);

  // Restaura a última busca ao voltar para a página; salva o scroll ao sair.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ESTADO_BUSCA_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setKeyword(s.keyword ?? "");
        setOrgao(s.orgao ?? "");
        setUfs(s.ufs ?? []);
        setModalidades(s.modalidades ?? []);
        if (s.dataInicial) setDataInicial(s.dataInicial);
        if (s.dataFinal) setDataFinal(s.dataFinal);
        setValorMin(s.valorMin ?? "");
        setValorMax(s.valorMax ?? "");
        setPlataformas(s.plataformas ?? ["pncp"]);
        setApenasAberto(s.apenasAberto ?? true);
        setFiltrosAbertos(s.filtrosAbertos ?? false);
        setResultados(s.resultados ?? []);
        setPagina(s.pagina ?? 1);
        setTotalPaginas(s.totalPaginas ?? 0);
        setTotalRegistros(s.totalRegistros ?? 0);
        setBuscou(true);
        requestAnimationFrame(() => window.scrollTo({ top: s.scrollY ?? 0 }));
      }
    } catch { /* ignora */ }

    return () => {
      try {
        const raw = sessionStorage.getItem(ESTADO_BUSCA_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          s.scrollY = window.scrollY;
          sessionStorage.setItem(ESTADO_BUSCA_KEY, JSON.stringify(s));
        }
      } catch { /* ignora */ }
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function buscar(paginaAlvo = 1) {
    setCarregando(true);
    setErro(null);
    setBuscou(true);
    setPagina(paginaAlvo);

    const filtro = {
      keyword: keyword || undefined,
      orgao: orgao || undefined,
      ufs: ufs.length > 0 ? ufs : undefined,
      modalidades: modalidades.length > 0 ? modalidades.map(Number) : undefined,
      dataInicial,
      dataFinal,
      valorMin: valorMin ? Number(valorMin) : undefined,
      valorMax: valorMax ? Number(valorMax) : undefined,
      plataformas: plataformas as PlatformId[],
      apenasAberto,
      pagina: paginaAlvo,
    } satisfies UniversalFilter & { pagina: number };

    try {
      const res = await fetch("/api/licitacoes/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filtro),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao buscar");
      setResultados(json.resultados);
      setTotalPaginas(json.totalPaginas ?? 0);
      setTotalRegistros(json.totalRegistros ?? 0);
      try {
        sessionStorage.setItem(ESTADO_BUSCA_KEY, JSON.stringify({
          keyword, orgao, ufs, modalidades, dataInicial, dataFinal, valorMin, valorMax,
          plataformas, apenasAberto, filtrosAbertos,
          resultados: json.resultados, pagina: paginaAlvo,
          totalPaginas: json.totalPaginas ?? 0, totalRegistros: json.totalRegistros ?? 0, scrollY: 0,
        }));
      } catch { /* sessionStorage indisponível */ }
      if (json.incompleto) {
        if ((json.resultados?.length ?? 0) === 0) {
          toast.error("PNCP indisponível", { description: "O portal não respondeu a tempo. Tente buscar novamente." });
        } else {
          toast.warning("Resultados parciais", { description: "O PNCP está instável; alguns resultados podem ter ficado de fora." });
        }
      }
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao buscar licitações";
      setErro(msg);
      toast.error("Erro na busca", { description: msg });
    } finally {
      setCarregando(false);
    }
  }

  function salvar(licitacao: UnifiedLicitacao) {
    const chave = `${licitacao.plataforma}-${licitacao.numeroControlePNCP}`;
    const t = toast.loading("Salvando licitação…");
    salvarTransition(async () => {
      try {
        await salvarLicitacao(licitacao);
        setSalvas((prev) => new Set(prev).add(chave));
        toast.success("Licitação salva", { id: t, description: "Disponível em Minhas Licitações." });
      } catch (e) {
        toast.error("Não foi possível salvar", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Busca de Licitações</h1>
        <p className="text-sm text-muted-foreground">
          Pesquise licitações em múltiplas plataformas com filtros unificados.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="gap-2 px-2"
              onClick={() => setFiltrosAbertos((v) => !v)}
              aria-expanded={filtrosAbertos}
            >
              <SlidersHorizontal className="size-4" />
              Filtros
              {filtrosAtivos > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5">
                  {filtrosAtivos}
                </Badge>
              )}
              <ChevronDown
                className={cn("size-4 transition-transform", filtrosAbertos && "rotate-180")}
              />
            </Button>
            <Button onClick={() => buscar(1)} disabled={carregando}>
              {carregando ? <Loader2 className="animate-spin" /> : <Search />}
              Buscar
            </Button>
          </div>

          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={apenasAberto}
              onCheckedChange={(v) => setApenasAberto(v === true)}
            />
            <span>Somente licitações em aberto para proposta</span>
          </label>

          {filtrosAbertos && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label>Palavra-chave</Label>
                  <Input
                    placeholder="ex: informática, merenda, obra..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Órgão</Label>
                  <Input
                    placeholder="ex: prefeitura, secretaria..."
                    value={orgao}
                    onChange={(e) => setOrgao(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Plataformas</Label>
                  <MultiToggle
                    options={PLATAFORMAS.map((p) => ({ value: p.id, label: p.nome }))}
                    selected={plataformas}
                    onChange={setPlataformas}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <Label>Publicado a partir de</Label>
                  <Input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Publicado até</Label>
                  <Input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Valor mínimo (R$)</Label>
                  <Input type="number" min={0} value={valorMin} onChange={(e) => setValorMin(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Valor máximo (R$)</Label>
                  <Input type="number" min={0} value={valorMax} onChange={(e) => setValorMax(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>UF</Label>
                <MultiToggle
                  options={UFS.map((uf) => ({ value: uf, label: uf }))}
                  selected={ufs}
                  onChange={setUfs}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Modalidade</Label>
                <MultiToggle
                  options={MODALIDADES.map((m) => ({ value: String(m.id), label: m.nome }))}
                  selected={modalidades}
                  onChange={setModalidades}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {erro && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
      )}

      {carregando && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {!carregando && !buscou && (
        <EmptyState
          icon={FileSearch}
          titulo="Pronto para buscar"
          descricao="Defina os filtros desejados e clique em Buscar para encontrar licitações."
        />
      )}

      {!carregando && buscou && resultados.length === 0 && (
        <EmptyState
          icon={SearchX}
          titulo="Nenhuma licitação encontrada"
          descricao="Tente ampliar o período, remover filtros ou incluir mais plataformas."
        />
      )}

      {!carregando && resultados.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Mostrando <span className="font-medium text-foreground">{resultados.length}</span>
            {totalRegistros > 0 && (
              <> de ~<span className="font-medium text-foreground">{totalRegistros}</span></>
            )}{" "}
            licitação(ões){totalPaginas > 1 && <> · página {pagina} de {totalPaginas}</>}
          </p>
          {resultados.map((item) => {
            const chave = `${item.plataforma}-${item.numeroControlePNCP}`;
            const jaSalva = salvas.has(chave);
            return (
              <LicitacaoCard
                key={chave}
                href={`/licitacao/pncp?n=${encodeURIComponent(item.numeroControlePNCP)}`}
                numeroControlePNCP={item.numeroControlePNCP}
                plataformaNome={PLATAFORMA_NOME[item.plataforma] ?? item.plataforma}
                situacao={item.situacao}
                titulo={item.titulo}
                orgao={item.orgao}
                uf={item.uf}
                municipio={item.municipio}
                modalidade={item.modalidade}
                valorEstimado={item.valorEstimado}
                dataAbertura={item.dataAberturaProposta}
                dataEncerramento={item.dataEncerramentoProposta}
                linkOrigem={item.linkOrigem}
                action={
                  <Button
                    size="sm"
                    variant={jaSalva ? "secondary" : "outline"}
                    disabled={jaSalva}
                    onClick={() => salvar(item)}
                  >
                    {jaSalva ? <Check /> : <BookmarkPlus />}
                    {jaSalva ? "Salva" : "Salvar"}
                  </Button>
                }
              />
            );
          })}

          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={carregando || pagina <= 1}
                onClick={() => buscar(pagina - 1)}
              >
                <ChevronLeft />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {pagina} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={carregando || pagina >= totalPaginas}
                onClick={() => buscar(pagina + 1)}
              >
                Próxima
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  titulo,
  descricao,
}: {
  icon: typeof FileSearch;
  titulo: string;
  descricao: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{titulo}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p>
        </div>
      </CardContent>
    </Card>
  );
}
