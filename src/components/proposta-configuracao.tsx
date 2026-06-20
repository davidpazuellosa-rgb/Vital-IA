"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, CircleAlert, FileCheck2, Loader2, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmpresaDados } from "@/lib/empresa/actions";
import { salvarConfiguracaoProposta } from "@/lib/propostas/actions";
import type { PropostaConfiguracao } from "@/lib/propostas/types";

export function PropostaConfiguracaoForm({
  configuracao,
  empresa,
  temModelo,
}: {
  configuracao: PropostaConfiguracao;
  empresa: EmpresaDados;
  temModelo: boolean;
}) {
  const [pendente, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const empresaCompleta = Boolean(
    empresa.razao_social && empresa.cnpj && empresa.email && empresa.telefone && empresa.dados_bancarios,
  );
  const regrasCompletas = Boolean(configuracao.prazo_entrega && configuracao.condicoes_pagamento);
  const representanteCompleto = Boolean(configuracao.representante_legal && configuracao.representante_cargo);
  const completos = [empresaCompleta, temModelo, regrasCompletas, representanteCompleto].filter(Boolean).length;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSalvo(false);
    startTransition(async () => {
      await salvarConfiguracaoProposta(formData);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    });
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Propostas</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Base que o agente usará para preparar propostas específicas para cada licitação.
            </p>
          </div>
          <Badge variant="secondary" className="font-medium tabular-nums">{completos} / 4 prontos</Badge>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ItemChecklist pronto={empresaCompleta} titulo="Dados cadastrais e bancários" descricao="Identificação, contato e conta da Vital Norte" />
          <ItemChecklist pronto={temModelo} titulo="Modelo de proposta" descricao="Proposta vencedora usada como referência" href="/documentos" />
          <ItemChecklist pronto={regrasCompletas} titulo="Condições comerciais" descricao="Validade, entrega, pagamento e impostos" />
          <ItemChecklist pronto={representanteCompleto} titulo="Responsável pela proposta" descricao="Nome e cargo para assinatura" />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 border-t pt-5">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-primary" />
            <h3 className="font-semibold">Padrões para novas propostas</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo label="Validade da proposta (dias)" htmlFor="validade_dias">
              <Input id="validade_dias" name="validade_dias" type="number" min={1} defaultValue={configuracao.validade_dias} />
            </Campo>
            <Campo label="Prazo de entrega" htmlFor="prazo_entrega">
              <Input id="prazo_entrega" name="prazo_entrega" defaultValue={configuracao.prazo_entrega} placeholder="Ex.: até 15 dias úteis" />
            </Campo>
            <Campo label="Condições de pagamento" htmlFor="condicoes_pagamento">
              <Input id="condicoes_pagamento" name="condicoes_pagamento" defaultValue={configuracao.condicoes_pagamento} placeholder="Ex.: até 30 dias" />
            </Campo>
            <Campo label="Representante legal" htmlFor="representante_legal">
              <Input id="representante_legal" name="representante_legal" defaultValue={configuracao.representante_legal} />
            </Campo>
            <Campo label="Cargo / função" htmlFor="representante_cargo">
              <Input id="representante_cargo" name="representante_cargo" defaultValue={configuracao.representante_cargo} />
            </Campo>
            <div className="flex items-center gap-2 self-end rounded-lg border px-3 py-2.5">
              <Checkbox id="impostos_inclusos" name="impostos_inclusos" defaultChecked={configuracao.impostos_inclusos} />
              <Label htmlFor="impostos_inclusos" className="leading-snug">Impostos e despesas inclusos</Label>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="observacoes_padrao">Observações padrão</Label>
              <textarea
                id="observacoes_padrao"
                name="observacoes_padrao"
                defaultValue={configuracao.observacoes_padrao}
                rows={3}
                className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {salvo && <span className="flex items-center gap-1.5 text-sm font-medium text-primary"><Check className="size-4" /> Salvo</span>}
            <Button type="submit" disabled={pendente}>
              {pendente && <Loader2 className="animate-spin" />}
              Salvar padrões
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Campo({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function ItemChecklist({ pronto, titulo, descricao, href }: { pronto: boolean; titulo: string; descricao: string; href?: string }) {
  const conteudo = (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5">
      <div className={pronto ? "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" : "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"}>
        {pronto ? <Check className="size-4" /> : <CircleAlert className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{titulo}</p>
        <p className="truncate text-xs text-muted-foreground">{descricao}</p>
      </div>
      <Badge variant="outline" className={pronto ? "border-transparent bg-primary/10 text-primary" : "text-muted-foreground"}>
        {pronto ? "Pronto" : "Pendente"}
      </Badge>
    </div>
  );
  return href ? <Link href={href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{conteudo}</Link> : conteudo;
}
