import { Receipt, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
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
  const [{ data: notasData }, { data: clientesData }] = await Promise.all([
    supabase
      .from("notas_fiscais")
      .select("*, clientes(nome, orgao)")
      .order("created_at", { ascending: false }),
    supabase.from("clientes").select("id, nome, orgao").order("nome", { ascending: true }),
  ]);

  const notas = (notasData ?? []) as NotaComCliente[];
  const clientes = (clientesData ?? []) as { id: string; nome: string; orgao: string }[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nota Fiscal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Emita NF-e de venda para os órgãos e acompanhe a autorização na SEFAZ.
          </p>
        </div>
        <NovaNotaFiscal clientes={clientes} />
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
                    <div className="min-w-0">
                      <p className="truncate font-semibold leading-tight">{titulo}</p>
                      {n.clientes?.orgao && (
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Building2 className="size-3 shrink-0" /> {n.clientes.orgao}
                        </p>
                      )}
                    </div>
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

                  <NotaFiscalAcoes
                    id={n.id}
                    status={n.status}
                    danfeUrl={n.danfe_url}
                    xmlUrl={n.xml_url}
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
