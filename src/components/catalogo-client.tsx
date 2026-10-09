"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Package, Pencil, Plus, Search, Trash2, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarMoeda } from "@/lib/format";
import { atualizarItemCatalogo, criarItemCatalogo, removerItemCatalogo } from "@/lib/catalogo/actions";
import { margemReal, type ItemCatalogo } from "@/lib/catalogo/types";
import { cn } from "@/lib/utils";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const decimal = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

export function Catalogo({ itens }: { itens: ItemCatalogo[] }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<"todos" | "produto" | "servico">("todos");

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return itens.filter((i) =>
      (tipo === "todos" || i.tipo === tipo) &&
      (!termo || semAcento(`${i.nome} ${i.descricao} ${i.categoria} ${i.marca} ${i.codigo} ${i.fornecedores}`).includes(termo)),
    );
  }, [itens, busca, tipo]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, marca, categoria, código ou fornecedor…" className="pl-9" />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["todos", "produto", "servico"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={cn("rounded-md px-3 py-1 text-sm font-medium transition-colors", tipo === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {t === "todos" ? "Todos" : t === "produto" ? "Produtos" : "Serviços"}
            </button>
          ))}
        </div>
      </div>

      {itens.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Package className="size-6" /></div>
            <p className="font-medium">Catálogo vazio</p>
            <FormItem />
          </CardContent>
        </Card>
      ) : visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nenhum item encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Categoria</th>
                <th className="px-3 py-2 font-medium">Marca</th>
                <th className="px-3 py-2 text-right font-medium">Custo</th>
                <th className="px-3 py-2 text-right font-medium">Preço ref.</th>
                <th className="px-3 py-2 text-right font-medium">Margem</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visiveis.map((i) => {
                const margem = margemReal(i.custo, i.preco_referencia);
                const abaixo = margem != null && i.margem_minima != null && margem < i.margem_minima;
                return (
                  <tr key={i.id} className={cn("align-top", !i.ativo && "opacity-60")}>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        {i.tipo === "servico" ? <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0">
                          <p className="font-medium">{i.nome}{!i.ativo && <Badge variant="outline" className="ml-2 font-normal">inativo</Badge>}</p>
                          {(i.descricao || i.unidade || i.codigo) && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {[i.unidade && `Unidade: ${i.unidade}`, i.codigo && `Cód.: ${i.codigo}`, i.descricao].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{i.categoria || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{i.marca || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.custo != null ? formatarMoeda(i.custo) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.preco_referencia != null ? formatarMoeda(i.preco_referencia) : "—"}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", abaixo && "font-medium text-destructive")} title={i.margem_minima != null ? `Mínima: ${decimal(i.margem_minima)}%` : undefined}>
                      {margem != null ? `${decimal(Math.round(margem * 10) / 10)}%` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <FormItem item={i} />
                        <RemoverItem id={i.id} nome={i.nome} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FormItem({ item }: { item?: ItemCatalogo }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (item) await atualizarItemCatalogo(item.id, fd);
        else await criarItemCatalogo(fd);
        setAberto(false);
        toast.success(item ? "Item atualizado" : "Item cadastrado");
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) setErro(null); }}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="ghost" size="icon" title="Editar" aria-label={`Editar ${item.nome}`}><Pencil /></Button>
        ) : (
          <Button><Plus /> Adicionar item</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item do catálogo" : "Novo item do catálogo"}</DialogTitle>
          <DialogDescription>Preços sem impostos de licitação; a Vita usa custo e margem para sugerir preço.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2">
          <Campo nome="nome" rotulo="Nome" padrao={item?.nome} obrigatorio classe="sm:col-span-2" exemplo="Ex.: Açúcar cristal 1 kg" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-tipo">Tipo</Label>
            <select id="cat-tipo" name="tipo" defaultValue={item?.tipo ?? "produto"} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs">
              <option value="produto">Produto</option>
              <option value="servico">Serviço</option>
            </select>
          </div>
          <Campo nome="categoria" rotulo="Categoria" padrao={item?.categoria} exemplo="Ex.: Gêneros alimentícios" />
          <Campo nome="unidade" rotulo="Unidade" padrao={item?.unidade} exemplo="UN, CX, KG, PCT, HORA" />
          <Campo nome="marca" rotulo="Marca" padrao={item?.marca} exemplo="Ex.: União" />
          <Campo nome="codigo" rotulo="Código (CATMAT/CATSER/NCM)" padrao={item?.codigo} exemplo="Opcional" />
          <Campo nome="fornecedores" rotulo="Fornecedores" padrao={item?.fornecedores} exemplo="Ex.: Atacadão, Distribuidora X" />
          <Campo nome="custo" rotulo="Custo unitário (R$)" padrao={decimal(item?.custo ?? null)} exemplo="0,00" numerico />
          <Campo nome="preco_referencia" rotulo="Preço de referência (R$)" padrao={decimal(item?.preco_referencia ?? null)} exemplo="0,00" numerico />
          <Campo nome="margem_minima" rotulo="Margem mínima (%)" padrao={decimal(item?.margem_minima ?? null)} exemplo="Ex.: 18" numerico />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-ativo">Situação</Label>
            <select id="cat-ativo" name="ativo" defaultValue={item?.ativo === false ? "false" : "true"} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs">
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>
          <Campo nome="descricao" rotulo="Descrição / especificação" padrao={item?.descricao} classe="sm:col-span-2" exemplo="Especificação técnica, embalagem, validade…" />
          <Campo nome="observacoes" rotulo="Observações" padrao={item?.observacoes} classe="sm:col-span-2" exemplo="Opcional" />
          {erro && <p className="text-sm text-destructive sm:col-span-2">{erro}</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pendente}>{pendente && <Loader2 className="animate-spin" />} {item ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ nome, rotulo, padrao, exemplo, obrigatorio, numerico, classe }: {
  nome: string; rotulo: string; padrao?: string; exemplo?: string; obrigatorio?: boolean; numerico?: boolean; classe?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", classe)}>
      <Label htmlFor={`cat-${nome}`}>{rotulo}</Label>
      <Input id={`cat-${nome}`} name={nome} defaultValue={padrao ?? ""} placeholder={exemplo} required={obrigatorio} inputMode={numerico ? "decimal" : undefined} />
    </div>
  );
}

function RemoverItem({ id, nome }: { id: string; nome: string }) {
  const [pendente, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pendente}
      title="Remover"
      aria-label={`Remover ${nome}`}
      onClick={() => {
        if (!window.confirm(`Remover "${nome}" do catálogo?`)) return;
        startTransition(async () => {
          try { await removerItemCatalogo(id); toast.success("Item removido"); }
          catch (e) { toast.error("Não foi possível remover", { description: e instanceof Error ? e.message : undefined }); }
        });
      }}
    >
      {pendente ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
