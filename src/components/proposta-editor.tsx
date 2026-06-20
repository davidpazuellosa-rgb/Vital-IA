"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Check, CircleAlert, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarMoeda } from "@/lib/format";
import { salvarRascunhoProposta } from "@/lib/propostas/actions";
import type { PropostaItem, PropostaRascunho } from "@/lib/propostas/types";

type EmpresaProposta = {
  razao_social: string;
  cnpj: string;
  email: string;
  telefone: string;
  dados_bancarios: string;
};

export function PropostaEditor({
  licitacaoId,
  empresa,
  temModelo,
  prazoIdentificado,
  rascunho,
  itens,
}: {
  licitacaoId: string;
  empresa: EmpresaProposta;
  temModelo: boolean;
  prazoIdentificado: boolean;
  rascunho: PropostaRascunho;
  itens: PropostaItem[];
}) {
  const [pendente, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const [valores, setValores] = useState<Record<number, string>>(() =>
    Object.fromEntries(itens.map((item) => [item.numero, item.valor_unitario?.toString() ?? ""])),
  );
  const empresaCompleta = Boolean(empresa.razao_social && empresa.cnpj && empresa.email && empresa.telefone && empresa.dados_bancarios);
  const precosCompletos = itens.length > 0 && itens.every((item) => valores[item.numero]?.trim());
  const completos = [empresaCompleta, temModelo, itens.length > 0, precosCompletos, prazoIdentificado].filter(Boolean).length;

  const total = useMemo(() => itens.reduce((soma, item) => {
    const valor = Number((valores[item.numero] ?? "").replace(",", "."));
    return soma + (Number.isFinite(valor) ? valor * (item.quantidade ?? 0) : 0);
  }, 0), [itens, valores]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSalvo(false);
    startTransition(async () => {
      await salvarRascunhoProposta(licitacaoId, formData);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Checklist da proposta</h2>
              <p className="text-xs text-muted-foreground">O agente usará estes dados para montar o documento desta licitação.</p>
            </div>
            <Badge variant="secondary" className="font-medium tabular-nums">{completos} / 5 prontos</Badge>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Checklist pronto={empresaCompleta} texto="Dados da empresa" href="/vital-norte/dados" />
            <Checklist pronto={temModelo} texto="Modelo de proposta" href="/documentos" />
            <Checklist pronto={itens.length > 0} texto="Itens carregados" />
            <Checklist pronto={precosCompletos} texto="Preços preenchidos" />
            <Checklist pronto={prazoIdentificado} texto="Prazo identificado" />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Condições da licitação</h2>
            <p className="mt-1 text-xs text-muted-foreground">Prazo de entrega e pagamento devem seguir o edital ou Termo de Referência desta licitação.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Campo label="Validade (dias)" htmlFor="validade_dias">
              <Input id="validade_dias" name="validade_dias" type="number" min={1} defaultValue={rascunho.validade_dias} />
            </Campo>
            <Campo label="Prazo de entrega do edital" htmlFor="prazo_entrega">
              <Input id="prazo_entrega" name="prazo_entrega" defaultValue={rascunho.prazo_entrega} placeholder="Extraído do edital / Termo de Referência" />
            </Campo>
            <Campo label="Pagamento previsto no edital" htmlFor="condicoes_pagamento">
              <Input id="condicoes_pagamento" name="condicoes_pagamento" defaultValue={rascunho.condicoes_pagamento} placeholder="Extraído do edital / Termo de Referência" />
            </Campo>
          </div>
        </CardContent>
      </Card>

      <Card className="py-0 shadow-sm">
        <CardContent className="px-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5">
            <div>
              <h2 className="font-semibold">Itens da proposta</h2>
              <p className="text-xs text-muted-foreground">Informe marca e preço ofertado para cada item.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total da proposta</p>
              <p className="font-semibold text-primary tabular-nums">{formatarMoeda(total)}</p>
            </div>
          </div>
          {itens.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Não foi possível carregar os itens desta licitação.</p>
          ) : (
            <div className="divide-y">
              {itens.map((item) => (
                <div key={item.numero} className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_10rem_10rem]">
                  <input type="hidden" name="item_numero" value={item.numero} />
                  <input type="hidden" name={`item_${item.numero}_descricao`} value={item.descricao} />
                  <input type="hidden" name={`item_${item.numero}_quantidade`} value={item.quantidade ?? ""} />
                  <input type="hidden" name={`item_${item.numero}_unidade`} value={item.unidade} />
                  <div className="min-w-0">
                    <p className="font-medium leading-snug"><span className="mr-1.5 text-muted-foreground">{item.numero}.</span>{item.descricao}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.quantidade ?? "—"} {item.unidade}</p>
                  </div>
                  <Campo label="Marca / fabricante" htmlFor={`item_${item.numero}_marca`}>
                    <Input id={`item_${item.numero}_marca`} name={`item_${item.numero}_marca`} defaultValue={item.marca} placeholder="Opcional" />
                  </Campo>
                  <Campo label="Valor unitário" htmlFor={`item_${item.numero}_valor_unitario`}>
                    <Input
                      id={`item_${item.numero}_valor_unitario`}
                      name={`item_${item.numero}_valor_unitario`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={valores[item.numero] ?? ""}
                      onChange={(event) => setValores((atuais) => ({ ...atuais, [item.numero]: event.target.value }))}
                      placeholder="R$ 0,00"
                    />
                  </Campo>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-1.5">
          <Label htmlFor="observacoes">Observações da proposta</Label>
          <textarea
            id="observacoes"
            name="observacoes"
            defaultValue={rascunho.observacoes}
            rows={4}
            className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur-md">
        {salvo && <span className="mr-auto flex items-center gap-1.5 text-sm font-medium text-primary"><Check className="size-4" /> Rascunho salvo</span>}
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="animate-spin" /> : <Save />}
          Salvar rascunho
        </Button>
      </div>
    </form>
  );
}

function Campo({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function Checklist({ pronto, texto, href }: { pronto: boolean; texto: string; href?: string }) {
  const conteudo = (
    <div className="flex h-full items-center gap-2 rounded-lg border px-3 py-2.5">
      {pronto ? <Check className="size-4 shrink-0 text-primary" /> : <CircleAlert className="size-4 shrink-0 text-muted-foreground" />}
      <span className="text-sm font-medium">{texto}</span>
    </div>
  );
  return href ? <Link href={href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{conteudo}</Link> : conteudo;
}
