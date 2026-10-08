import { Globe, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { hostDe, type SistemaLicitacao } from "@/lib/sistemas/types";
import { AbrirSistema, CopiarLogin, FormSistema, RemoverSistema } from "@/components/sistemas-client";

export default async function SistemasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sistemas_licitacao")
    .select("*")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  const sistemas = (data ?? []) as SistemaLicitacao[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sistemas de Licitação</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Portais em que a empresa tem cadastro. Cada um abre na sua própria aba: entre uma vez e o
            navegador mantém o login — clicar em Abrir de novo volta para a mesma aba.
          </p>
        </div>
        <FormSistema />
      </div>

      {sistemas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Globe className="size-6" />
            </div>
            <p className="font-medium">Nenhum sistema cadastrado</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Adicione os portais de licitação em que a empresa tem cadastro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sistemas.map((s) => (
            <Card key={s.id} className="h-full shadow-sm">
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-base font-semibold text-primary-foreground">
                    {s.nome.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight">{s.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{hostDe(s.url)}</p>
                  </div>
                  <div className="-mr-2 -mt-1 flex shrink-0">
                    <FormSistema sistema={s} />
                    <RemoverSistema id={s.id} nome={s.nome} />
                  </div>
                </div>

                {(s.login || s.observacoes) && (
                  <div className="flex flex-col gap-1.5">
                    {s.login && (
                      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <KeyRound className="size-3.5 shrink-0" />
                        <CopiarLogin login={s.login} />
                      </div>
                    )}
                    {s.observacoes && <p className="text-xs text-muted-foreground">{s.observacoes}</p>}
                  </div>
                )}

                <div className="mt-auto flex pt-1">
                  <AbrirSistema id={s.id} url={s.url} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
