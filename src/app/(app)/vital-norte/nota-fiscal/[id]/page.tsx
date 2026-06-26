import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda, formatarData } from "@/lib/format";
import {
  NOTA_FISCAL_STATUS_LABEL,
  NOTA_FISCAL_STATUS_VARIANT,
  valorLinha,
  type NotaFiscal,
  type NotaFiscalItem,
} from "@/lib/nota-fiscal/types";
import { NotaFiscalAcoes } from "@/components/nota-fiscal-client";

type NotaDetalhe = NotaFiscal & {
  clientes: { nome: string; orgao: string } | null;
  contratacoes: { titulo: string; identificador: string } | null;
};

export default async function NotaFiscalDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notas_fiscais")
    .select("*, clientes(nome, orgao), contratacoes(titulo, identificador)")
    .eq("id", id)
    .single();
  if (!data) notFound();

  const nota = data as NotaDetalhe;
  const itens = (nota.itens ?? []) as NotaFiscalItem[];
  const titulo = nota.destinatario_nome || nota.clientes?.nome || "Nota fiscal";
  const endereco = [
    [nota.destinatario_logradouro, nota.destinatario_numero].filter(Boolean).join(", "),
    nota.destinatario_bairro,
    [nota.destinatario_municipio, nota.destinatario_uf].filter(Boolean).join(" / "),
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-2 text-muted-foreground">
        <Link href="/vital-norte/nota-fiscal">
          <ArrowLeft className="size-4" /> Voltar às notas
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {nota.numero ? `NF ${nota.numero}${nota.serie ? `/${nota.serie}` : ""} · ` : ""}
            {nota.natureza_operacao} · {formatarData(nota.created_at)}
          </p>
        </div>
        <Badge variant={NOTA_FISCAL_STATUS_VARIANT[nota.status]}>
          {NOTA_FISCAL_STATUS_LABEL[nota.status]}
        </Badge>
      </div>

      {nota.status === "rejeitada" && nota.motivo_rejeicao && (
        <Card className="border-destructive/40 shadow-sm">
          <CardContent className="text-sm text-destructive">{nota.motivo_rejeicao}</CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-4">
          <NotaFiscalAcoes
            id={nota.id}
            status={nota.status}
            danfeUrl={nota.danfe_url}
            xmlUrl={nota.xml_url}
            contratacaoId={nota.contratacao_id}
            jaAnexada={Boolean(nota.anexada_em)}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-2 text-sm">
            <h2 className="font-semibold">Destinatário</h2>
            <p>{nota.destinatario_nome || "—"}</p>
            {nota.destinatario_documento && (
              <p className="text-muted-foreground">Doc.: {nota.destinatario_documento}</p>
            )}
            {nota.destinatario_ie && (
              <p className="text-muted-foreground">IE: {nota.destinatario_ie}</p>
            )}
            {endereco && <p className="text-muted-foreground">{endereco}</p>}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-2 text-sm">
            <h2 className="font-semibold">Vínculo</h2>
            {nota.clientes?.nome ? (
              <p className="flex items-center gap-1.5">
                <Building2 className="size-3.5 text-muted-foreground" /> {nota.clientes.nome}
              </p>
            ) : (
              <p className="text-muted-foreground">Sem cliente vinculado</p>
            )}
            {nota.contratacoes?.titulo && (
              <p className="text-muted-foreground">
                {nota.contratacoes.titulo}
                {nota.contratacoes.identificador ? ` · ${nota.contratacoes.identificador}` : ""}
              </p>
            )}
            {nota.observacoes && (
              <p className="mt-1 border-t pt-2 text-muted-foreground">{nota.observacoes}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-semibold">Itens</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>NCM</TableHead>
                <TableHead>CFOP</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead className="text-right">Valor unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-normal font-medium">{item.descricao}</TableCell>
                  <TableCell className="text-muted-foreground">{item.ncm}</TableCell>
                  <TableCell className="text-muted-foreground">{item.cfop}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.quantidade} {item.unidade}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatarMoeda(item.valor_unitario)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatarMoeda(valorLinha(item))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end border-t pt-3 text-sm">
            <span className="text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatarMoeda(nota.valor_total)}</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
