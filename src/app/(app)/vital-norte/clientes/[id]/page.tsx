import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FileText, Gavel, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Cliente, Contratacao } from "@/lib/clientes/types";
import { RemoverClienteButton, ClienteStatus, AdicionarContratacao } from "@/components/clientes-client";

export default async function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", id).single();
  if (!cliente) notFound();
  const c = cliente as Cliente;

  const { data: contData } = await supabase
    .from("contratacoes")
    .select("*, cliente_documentos(count)")
    .eq("cliente_id", id)
    .order("created_at", { ascending: false });
  const contratacoes = (contData ?? []) as (Contratacao & { cliente_documentos: { count: number }[] })[];

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-2 text-muted-foreground">
        <Link href="/vital-norte/clientes"><ArrowLeft className="size-4" /> Clientes</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-base font-semibold text-primary-foreground">
            {c.nome.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.nome}</h1>
            {c.orgao && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="size-3.5" /> {c.orgao}
              </p>
            )}
          </div>
        </div>
        <RemoverClienteButton id={c.id} />
      </div>

      <Card className="shadow-sm">
        <CardContent>
          <ClienteStatus id={c.id} status={c.status ?? ""} proximoPasso={c.proximo_passo ?? ""} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Licitações / Contratações
        </h2>
        <AdicionarContratacao clienteId={c.id} />
      </div>

      {contratacoes.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma licitação ainda. Use &ldquo;Nova licitação&rdquo; para registrar uma contratação deste cliente.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {contratacoes.map((ct) => {
            const total = ct.cliente_documentos?.[0]?.count ?? 0;
            return (
              <Link key={ct.id} href={`/vital-norte/clientes/${c.id}/contratacao/${ct.id}`}>
                <Card className="h-full shadow-sm transition-colors hover:border-primary/50">
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Gavel className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold leading-tight">{ct.titulo}</p>
                        {ct.identificador && (
                          <p className="truncate text-xs text-muted-foreground">{ct.identificador}</p>
                        )}
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </div>
                    {ct.status && <Badge variant="secondary" className="w-fit font-normal">{ct.status}</Badge>}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="size-3.5" /> {total} documento{total === 1 ? "" : "s"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
