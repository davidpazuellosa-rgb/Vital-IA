import Link from "next/link";
import { Receipt, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { ambienteEhHomologacao } from "@/lib/nota-fiscal/engine";
import { formatarMoeda } from "@/lib/format";
import {
  NOTA_FISCAL_STATUS_LABEL,
  NOTA_FISCAL_STATUS_VARIANT,
  type NotaFiscal,
} from "@/lib/nota-fiscal/types";
import { NovaNotaFiscal, NotaFiscalAcoes } from "@/components/nota-fiscal-client";

type NotaComCliente = NotaFiscal & { clientes: { nome: string; orgao: string } | null };

export default async function NotaFiscalPage() {
  const supabase = await createClient();
  const [{ data: notasData }, { data: clientesData }, { data: contratacoesData }] =
    await Promise.all([
      supabase
        .from("notas_fiscais")
        .select("*, clientes(nome, orgao)")
        .order("created_at", { ascending: false }),
      supabase
        .from("clientes")
        .select("id, nome, orgao, cnpj, inscricao_estadual, cep, logradouro, numero, bairro, municipio, uf")
        .order("nome", { ascending: true }),
      supabase
        .from("contratacoes")
        .select("id, cliente_id, titulo, identificador")
        .order("created_at", { ascending: false }),
    ]);

  const notas = (notasData ?? []) as NotaComCliente[];
  const clientes = (clientesData ?? []) as {
    id: string; nome: string; orgao: string; cnpj: string; inscricao_estadual: string;
    cep: string; logradouro: string; numero: string; bairro: string; municipio: string; uf: string;
  }[];
  const contratacoes = (contratacoesData ?? []) as {
    id: string;
    cliente_id: string;
    titulo: string;
    identificador: string;
  }[];
  const contratacoesPorCliente: Record<
    string,
    { id: string; titulo: string; identificador: string }[]
  > = {};
  for (const c of contratacoes) {
    (contratacoesPorCliente[c.cliente_id] ??= []).push({
      id: c.id,
      titulo: c.titulo,
      identificador: c.identificador,
    });
  }

  const homologacao = await ambienteEhHomologacao();

  return (
    <div className="flex flex-col gap-5">
      {homologacao && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          Ambiente de homologação — as notas emitidas aqui não têm valor fiscal.
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nota Fiscal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Emita NF-e de venda para os órgãos e acompanhe a autorização na SEFAZ.
          </p>
        </div>
        <NovaNotaFiscal clientes={clientes} contratacoesPorCliente={contratacoesPorCliente} />
      </div>

      {notas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Receipt className="size-6" />
            </div>
            <p className="font-medium">Nenhuma nota emitida ainda</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crie uma nota fiscal para enviar à SEFAZ e baixar o DANFE e o XML.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notas.map((n) => {
            const titulo = n.destinatario_nome || n.clientes?.nome || "Sem destinatário";
            return (
              <Card key={n.id} className="h-full shadow-sm">
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/vital-norte/nota-fiscal/${n.id}`} className="min-w-0 hover:underline">
                      <p className="truncate font-semibold leading-tight">{titulo}</p>
                      {n.clientes?.orgao && (
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Building2 className="size-3 shrink-0" /> {n.clientes.orgao}
                        </p>
                      )}
                    </Link>
                    <Badge variant={NOTA_FISCAL_STATUS_VARIANT[n.status]} className="shrink-0">
                      {NOTA_FISCAL_STATUS_LABEL[n.status]}
                    </Badge>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-semibold">{formatarMoeda(n.valor_total)}</span>
                    {n.numero && (
                      <span className="text-xs text-muted-foreground">
                        NF {n.numero}
                        {n.serie ? `/${n.serie}` : ""}
                      </span>
                    )}
                  </div>

                  {n.status === "rejeitada" && n.motivo_rejeicao && (
                    <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                      {n.motivo_rejeicao}
                    </p>
                  )}

                  {n.status === "rascunho" && (
                    <NovaNotaFiscal
                      key={n.updated_at}
                      clientes={clientes}
                      contratacoesPorCliente={contratacoesPorCliente}
                      inicial={{
                        id: n.id,
                        cliente_id: n.cliente_id,
                        contratacao_id: n.contratacao_id,
                        natureza_operacao: n.natureza_operacao,
                        observacoes: n.observacoes,
                        destinatario_nome: n.destinatario_nome,
                        destinatario_documento: n.destinatario_documento,
                        destinatario_ie: n.destinatario_ie,
                        destinatario_ind_ie: n.destinatario_ind_ie,
                        destinatario_cep: n.destinatario_cep,
                        destinatario_logradouro: n.destinatario_logradouro,
                        destinatario_numero: n.destinatario_numero,
                        destinatario_bairro: n.destinatario_bairro,
                        destinatario_municipio: n.destinatario_municipio,
                        destinatario_uf: n.destinatario_uf,
                        itens: n.itens,
                      }}
                    />
                  )}

                  <NotaFiscalAcoes
                    id={n.id}
                    status={n.status}
                    danfeUrl={n.danfe_url}
                    xmlUrl={n.xml_url}
                    contratacaoId={n.contratacao_id}
                    jaAnexada={Boolean(n.anexada_em)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
