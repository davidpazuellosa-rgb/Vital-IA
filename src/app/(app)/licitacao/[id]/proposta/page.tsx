import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PropostaEditor } from "@/components/proposta-editor";
import { createClient } from "@/lib/supabase/server";
import { buscarItensPncp } from "@/lib/licitacoes/providers/pncp-itens";
import { CONFIGURACAO_PROPOSTA_PADRAO, type PropostaItem, type PropostaRascunho } from "@/lib/propostas/types";

export default async function PropostaLicitacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: licitacao }, { data: empresa }, { data: configuracao }, { data: proposta }, { count: modelos }] = await Promise.all([
    supabase.from("saved_licitacoes").select("*").eq("id", id).single(),
    supabase.from("empresa").select("*").maybeSingle(),
    supabase.from("proposta_configuracao").select("*").maybeSingle(),
    supabase.from("propostas").select("*").eq("licitacao_id", id).maybeSingle(),
    supabase.from("documentos").select("id", { count: "exact", head: true }).eq("tipo", "modelo_proposta"),
  ]);
  if (!licitacao) notFound();

  const itensPncp = await buscarItensPncp(licitacao.numero_controle_pncp);
  const itensSalvos = ((proposta?.itens ?? []) as PropostaItem[]);
  const salvosPorNumero = new Map(itensSalvos.map((item) => [item.numero, item]));
  const itens: PropostaItem[] = itensPncp.map((item) => ({
    numero: item.numeroItem,
    descricao: item.descricao,
    quantidade: item.quantidade,
    unidade: item.unidadeMedida,
    marca: salvosPorNumero.get(item.numeroItem)?.marca ?? "",
    valor_unitario: salvosPorNumero.get(item.numeroItem)?.valor_unitario ?? null,
  }));
  const base = { ...CONFIGURACAO_PROPOSTA_PADRAO, ...(configuracao ?? {}) };
  const rascunho: PropostaRascunho = {
    status: proposta?.status ?? "rascunho",
    validade_dias: proposta?.validade_dias ?? base.validade_dias,
    prazo_entrega: proposta?.prazo_entrega ?? "",
    condicoes_pagamento: proposta?.condicoes_pagamento ?? "",
    observacoes: proposta?.observacoes ?? base.observacoes_padrao,
    itens,
  };

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-2 text-muted-foreground">
        <Link href={`/licitacao/${id}`}><ArrowLeft className="size-4" /> Licitação</Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2"><FileText className="size-5 text-primary" /><h1 className="text-2xl font-semibold tracking-tight">Criar proposta</h1></div>
          <p className="max-w-3xl text-sm text-muted-foreground">{licitacao.titulo}</p>
        </div>
        <Badge variant={rascunho.status === "pronta" ? "default" : "secondary"}>{rascunho.status === "pronta" ? "Pronta para revisar" : "Rascunho"}</Badge>
      </div>
      <PropostaEditor
        licitacaoId={id}
        empresa={{
          razao_social: empresa?.razao_social ?? "",
          cnpj: empresa?.cnpj ?? "",
          email: empresa?.email ?? "",
          telefone: empresa?.telefone ?? "",
          dados_bancarios: empresa?.dados_bancarios ?? "",
        }}
        temModelo={(modelos ?? 0) > 0}
        prazoIdentificado={Boolean(licitacao.data_encerramento_proposta)}
        rascunho={rascunho}
        itens={itens}
      />
    </div>
  );
}
