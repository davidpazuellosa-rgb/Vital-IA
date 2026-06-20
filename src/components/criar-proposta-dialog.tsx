"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  FileSearch,
  FileText,
  Loader2,
  Package,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { analisarEditalLicitacao } from "@/lib/propostas/actions";
import type { AnaliseEdital, RequisitoEdital, StatusRequisito } from "@/lib/propostas/types";
import { cn } from "@/lib/utils";

export function CriarPropostaDialog({
  licitacaoId,
  variant = "outline",
  size = "default",
  compacto = false,
  className,
}: {
  licitacaoId: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
  compacto?: boolean;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [analise, setAnalise] = useState<AnaliseEdital | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function executarAnalise() {
    setErro(null);
    startTransition(async () => {
      try {
        setAnalise(await analisarEditalLicitacao(licitacaoId));
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível analisar o edital.");
      }
    });
  }

  function alterarAbertura(novoEstado: boolean) {
    setAberto(novoEstado);
    if (novoEstado && !analise && !pendente) executarAnalise();
  }

  return (
    <Dialog open={aberto} onOpenChange={alterarAbertura}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className} aria-label="Criar proposta">
          <FileText />
          {!compacto && "Criar proposta"}
          {compacto && <span className="hidden xl:inline">Proposta</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSearch className="size-5 text-primary" /> Análise para criar proposta</DialogTitle>
          <DialogDescription>
            Leitura dos arquivos publicados no PNCP, cruzamento com os documentos da Vital Norte e conferência dos itens.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          {pendente && <EstadoAnalisando />}
          {erro && <EstadoErro mensagem={erro} onTentarNovamente={executarAnalise} />}
          {analise && !pendente && <ResultadoAnalise analise={analise} />}
        </div>

        {analise && !pendente && (
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={executarAnalise}><RefreshCw /> Analisar novamente</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EstadoAnalisando() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-5 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Loader2 className="size-7 animate-spin" /></div>
      <div className="space-y-1"><p className="font-semibold">Lendo o edital completo</p><p className="text-sm text-muted-foreground">Isso pode levar alguns instantes.</p></div>
      <div className="grid w-full max-w-lg gap-2 text-left sm:grid-cols-3">
        <EtapaAnalise texto="Baixando anexos" />
        <EtapaAnalise texto="Lendo todas as páginas" />
        <EtapaAnalise texto="Conferindo documentos" />
      </div>
    </div>
  );
}

function EtapaAnalise({ texto }: { texto: string }) {
  return <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin text-primary" />{texto}</div>;
}

function EstadoErro({ mensagem, onTentarNovamente }: { mensagem: string; onTentarNovamente: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><CircleAlert className="size-6" /></div>
      <div><p className="font-semibold">Não foi possível concluir a análise</p><p className="mt-1 text-sm text-muted-foreground">{mensagem}</p></div>
      <Button variant="outline" onClick={onTentarNovamente}><RefreshCw /> Tentar novamente</Button>
    </div>
  );
}

function ResultadoAnalise({ analise }: { analise: AnaliseEdital }) {
  const disponiveis = analise.documentos.filter((item) => item.status === "disponivel").length;
  const pendencias = analise.documentos.filter((item) => item.status === "faltante" || item.status === "vencido").length;

  return (
    <div className="flex flex-col gap-4 pb-1">
      {!analise.cobertura.leituraCompleta && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div><p className="font-medium">Análise parcial</p><p className="text-xs text-muted-foreground">Há arquivo sem texto legível, formato não suportado ou falha de download. Faça a revisão manual antes do envio.</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Resumo rotulo="Arquivos lidos" valor={`${analise.cobertura.arquivosLidos}/${analise.cobertura.totalArquivos}`} />
        <Resumo rotulo="Páginas lidas" valor={String(analise.cobertura.paginasLidas)} />
        <Resumo rotulo="Documentos disponíveis" valor={String(disponiveis)} destaque />
        <Resumo rotulo="Pendências" valor={String(pendencias)} alerta={pendencias > 0} />
      </div>

      <GrupoResultado titulo="Documentos exigidos" descricao="Cruzamento com o acervo da Vital Norte" quantidade={analise.documentos.length} aberto>
        {analise.documentos.length > 0 ? analise.documentos.map((item) => <LinhaRequisito key={`${item.nome}-${item.origem}`} item={item} />) : <Vazio texto="Nenhum documento de habilitação foi identificado automaticamente." />}
      </GrupoResultado>

      <GrupoResultado titulo="Declarações da proposta" descricao="Declarações específicas que precisam ser geradas" quantidade={analise.declaracoes.length} aberto>
        {analise.declaracoes.length > 0 ? analise.declaracoes.map((item) => <LinhaRequisito key={`${item.nome}-${item.origem}`} item={item} />) : <Vazio texto="Nenhuma declaração específica foi identificada automaticamente." />}
      </GrupoResultado>

      <GrupoResultado titulo="Itens" descricao="Itens publicados para esta contratação" quantidade={analise.itens.length} aberto>
        {analise.itens.length > 0 ? analise.itens.map((item) => (
          <div key={item.numeroItem} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Package className="size-4 text-muted-foreground" /></div>
            <div className="min-w-0 flex-1"><p className="font-medium leading-snug"><span className="mr-1 text-muted-foreground">{item.numeroItem}.</span>{item.descricao}</p><p className="mt-0.5 text-xs text-muted-foreground">Quantidade: {item.quantidade ?? "—"} {item.unidadeMedida}</p></div>
          </div>
        )) : <Vazio texto="Nenhum item foi retornado pelo PNCP." />}
      </GrupoResultado>

      <GrupoResultado titulo="Condições identificadas" descricao="Validade, entrega, pagamento, local e garantia" quantidade={analise.condicoes.length}>
        {analise.condicoes.length > 0 ? analise.condicoes.map((item) => (
          <div key={`${item.nome}-${item.origem}`} className="rounded-lg border px-3 py-2.5"><p className="font-medium">{item.nome}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.trecho}</p><p className="mt-1 text-[11px] text-primary">Fonte: {item.origem}</p></div>
        )) : <Vazio texto="Nenhuma condição foi identificada automaticamente." />}
      </GrupoResultado>

      <GrupoResultado titulo="Arquivos analisados" descricao="Cobertura da leitura do edital e anexos" quantidade={analise.arquivos.length}>
        {analise.arquivos.map((arquivo) => (
          <div key={arquivo.sequencial} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <FileCheck2 className={cn("size-4 shrink-0", arquivo.status === "lido" ? "text-primary" : "text-destructive")} />
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{arquivo.titulo}</p><p className="text-xs text-muted-foreground">{arquivo.tipo} · {arquivo.paginas} página(s)</p></div>
            <Badge variant="outline" className={arquivo.status === "lido" ? "border-transparent bg-primary/10 text-primary" : "text-destructive"}>{rotuloArquivo(arquivo.status)}</Badge>
          </div>
        ))}
      </GrupoResultado>

      {analise.alertas.map((alerta) => <div key={alerta} className="flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{alerta}</div>)}
    </div>
  );
}

function Resumo({ rotulo, valor, destaque, alerta }: { rotulo: string; valor: string; destaque?: boolean; alerta?: boolean }) {
  return <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{rotulo}</p><p className={cn("mt-1 text-lg font-semibold tabular-nums", destaque && "text-primary", alerta && "text-destructive")}>{valor}</p></div>;
}

function GrupoResultado({ titulo, descricao, quantidade, aberto = false, children }: { titulo: string; descricao: string; quantidade: number; aberto?: boolean; children: React.ReactNode }) {
  return (
    <details open={aberto} className="group rounded-xl border bg-background [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform [details[open]_&]:rotate-90" />
        <div className="min-w-0 flex-1"><p className="font-semibold">{titulo}</p><p className="truncate text-xs text-muted-foreground">{descricao}</p></div>
        <Badge variant="secondary" className="tabular-nums">{quantidade}</Badge>
      </summary>
      <div className="flex flex-col gap-2 border-t p-3">{children}</div>
    </details>
  );
}

const STATUS_REQUISITO: Record<StatusRequisito, { rotulo: string; classe: string; icon: typeof Check }> = {
  disponivel: { rotulo: "Disponível", classe: "border-transparent bg-primary/10 text-primary", icon: Check },
  faltante: { rotulo: "Faltante", classe: "border-transparent bg-destructive/10 text-destructive", icon: CircleAlert },
  vencido: { rotulo: "Vencido", classe: "border-transparent bg-destructive/10 text-destructive", icon: AlertTriangle },
  a_gerar: { rotulo: "A gerar", classe: "bg-muted text-muted-foreground", icon: FileText },
};

function LinhaRequisito({ item }: { item: RequisitoEdital }) {
  const status = STATUS_REQUISITO[item.status];
  const Icon = status.icon;
  return (
    <div className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4 text-muted-foreground" /></div>
      <div className="min-w-0 flex-1"><p className="font-medium">{item.nome}</p><p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.trecho}</p><p className="mt-1 text-[11px] text-primary">Fonte: {item.origem}</p></div>
      <Badge variant="outline" className={cn("shrink-0", status.classe)}>{status.rotulo}</Badge>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">{texto}</p>;
}

function rotuloArquivo(status: AnaliseEdital["arquivos"][number]["status"]): string {
  if (status === "lido") return "Lido";
  if (status === "sem_texto") return "Sem texto";
  if (status === "nao_suportado") return "Não suportado";
  return "Falha";
}
