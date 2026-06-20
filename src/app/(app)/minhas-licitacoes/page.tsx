import Link from "next/link";
import { Bookmark, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { PLATAFORMAS } from "@/lib/licitacoes/types";
import { LicitacaoCard } from "@/components/licitacao-card";
import { RemoverLicitacaoButton } from "@/components/remover-licitacao-button";

const PLATAFORMA_NOME: Record<string, string> = Object.fromEntries(
  PLATAFORMAS.map((p) => [p.id, p.nome]),
);

export default async function MinhasLicitacoesPage() {
  const supabase = await createClient();
  const { data: licitacoes } = await supabase
    .from("saved_licitacoes")
    .select("*")
    .order("created_at", { ascending: false });

  const total = licitacoes?.length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Minhas Licitações</h1>
        <p className="text-sm text-muted-foreground">
          {total > 0
            ? `${total} licitação(ões) salva(s).`
            : "Suas licitações salvas aparecem aqui."}
        </p>
      </div>

      {total === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bookmark className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Nenhuma licitação salva ainda</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Use a página de Busca para encontrar licitações e salvá-las para acompanhar depois.
              </p>
            </div>
            <Button asChild className="mt-2">
              <Link href="/busca">
                <Search />
                Ir para a Busca
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {licitacoes!.map((item) => (
            <LicitacaoCard
              key={item.id}
              href={`/licitacao/${item.id}`}
              plataformaNome={PLATAFORMA_NOME[item.plataforma] ?? item.plataforma}
              situacao={item.situacao}
              titulo={item.titulo}
              orgao={item.orgao}
              uf={item.uf}
              municipio={item.municipio}
              modalidade={item.modalidade}
              valorEstimado={item.valor_estimado}
              dataAbertura={item.data_abertura_proposta}
              dataEncerramento={item.data_encerramento_proposta}
              linkOrigem={item.link_origem}
              action={<RemoverLicitacaoButton id={item.id} />}
            />
          ))}
        </div>
      )}
    </div>
  );
}
