"use client";

import { useState, useTransition } from "react";
import { Loader2, Search, BookmarkPlus, Check, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiToggle } from "@/components/multi-toggle";
import { MODALIDADES, PLATAFORMAS, PlatformId, UFS, UnifiedLicitacao, UniversalFilter } from "@/lib/licitacoes/types";
import { formatarData, formatarMoeda } from "@/lib/format";
import { salvarLicitacao } from "@/lib/licitacoes/actions";

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
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const [resultados, setResultados] = useState<UnifiedLicitacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscou, setBuscou] = useState(false);
  const [salvas, setSalvas] = useState<Set<string>>(new Set());
  const [, salvarTransition] = useTransition();

  async function buscar() {
    setCarregando(true);
    setErro(null);
    setBuscou(true);

    const filtro: UniversalFilter = {
      keyword: keyword || undefined,
      orgao: orgao || undefined,
      ufs: ufs.length > 0 ? ufs : undefined,
      modalidades: modalidades.length > 0 ? modalidades.map(Number) : undefined,
      dataInicial,
      dataFinal,
      valorMin: valorMin ? Number(valorMin) : undefined,
      valorMax: valorMax ? Number(valorMax) : undefined,
      plataformas: plataformas as PlatformId[],
    };

    try {
      const res = await fetch("/api/licitacoes/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filtro),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao buscar");
      setResultados(json.resultados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao buscar licitações");
    } finally {
      setCarregando(false);
    }
  }

  function salvar(licitacao: UnifiedLicitacao) {
    const chave = `${licitacao.plataforma}-${licitacao.numeroControlePNCP}`;
    salvarTransition(async () => {
      await salvarLicitacao(licitacao);
      setSalvas((prev) => new Set(prev).add(chave));
    });
  }

  return (
    <div className="flex flex-col gap-4">
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
              <ChevronDown
                className={cn("size-4 transition-transform", filtrosAbertos && "rotate-180")}
              />
            </Button>
            <Button onClick={buscar} disabled={carregando}>
              {carregando ? <Loader2 className="animate-spin" /> : <Search />}
              Buscar
            </Button>
          </div>

          {filtrosAbertos && (
            <>
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
            </>
          )}
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      {carregando && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!carregando && buscou && (
        <p className="text-sm text-muted-foreground">{resultados.length} resultado(s)</p>
      )}

      {!carregando && resultados.length > 0 && (
        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Órgão / Objeto</TableHead>
                  <TableHead>UF / Município</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Valor estimado</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Encerramento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((item) => {
                  const chave = `${item.plataforma}-${item.numeroControlePNCP}`;
                  const jaSalva = salvas.has(chave);
                  return (
                    <TableRow key={chave}>
                      <TableCell>
                        <Badge variant="secondary">{item.plataforma}</Badge>
                      </TableCell>
                      <TableCell className="max-w-sm">
                        <div className="font-medium">{item.orgao}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2">{item.titulo}</div>
                      </TableCell>
                      <TableCell>
                        {item.municipio} / {item.uf}
                      </TableCell>
                      <TableCell>{item.modalidade}</TableCell>
                      <TableCell>{formatarMoeda(item.valorEstimado)}</TableCell>
                      <TableCell>{formatarData(item.dataAberturaProposta)}</TableCell>
                      <TableCell>{formatarData(item.dataEncerramentoProposta)}</TableCell>
                      <TableCell>{item.situacao}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={jaSalva ? "secondary" : "outline"}
                          disabled={jaSalva}
                          onClick={() => salvar(item)}
                        >
                          {jaSalva ? <Check /> : <BookmarkPlus />}
                          {jaSalva ? "Salva" : "Salvar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
