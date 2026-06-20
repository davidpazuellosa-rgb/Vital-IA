import Link from "next/link";
import { Users, Building2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { AdicionarCliente } from "@/components/clientes-client";
import type { Cliente } from "@/lib/clientes/types";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("*, cliente_documentos(count)")
    .order("created_at", { ascending: false });

  const clientes = (data ?? []) as (Cliente & { cliente_documentos: { count: number }[] })[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada cliente reúne suas propostas, notas de empenho, notas fiscais e contratos.
          </p>
        </div>
        <AdicionarCliente />
      </div>

      {clientes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="size-6" />
            </div>
            <p className="font-medium">Nenhum cliente ainda</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Adicione um cliente para organizar os documentos das licitações vencidas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientes.map((c) => {
            const total = c.cliente_documentos?.[0]?.count ?? 0;
            return (
              <Link key={c.id} href={`/vital-norte/clientes/${c.id}`}>
                <Card className="h-full shadow-sm transition-colors hover:border-primary/50">
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-base font-semibold text-primary-foreground">
                        {c.nome.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-tight">{c.nome}</p>
                        {c.orgao && (
                          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Building2 className="size-3 shrink-0" /> {c.orgao}
                          </p>
                        )}
                      </div>
                    </div>
                    {c.status && (
                      <Badge variant="secondary" className="w-fit font-normal">{c.status}</Badge>
                    )}
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="size-3.5" />
                      {total} documento{total === 1 ? "" : "s"}
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
