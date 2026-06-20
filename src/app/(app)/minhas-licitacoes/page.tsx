import Link from "next/link";
import { Bookmark, Search, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { PLATAFORMAS, ETAPAS_LICITACAO, ETAPA_PADRAO, type EtapaSlug } from "@/lib/licitacoes/types";
import { LicitacaoCard } from "@/components/licitacao-card";
import { RemoverLicitacaoButton } from "@/components/remover-licitacao-button";
import { EtapaSelect } from "@/components/etapa-select";
import { CriarPropostaDialog } from "@/components/criar-proposta-dialog";

const PLATAFORMA_NOME: Record<string, string> = Object.fromEntries(
  PLATAFORMAS.map((p) => [p.id, p.nome]),
);

type SavedLicitacao = {
  id: string;
  plataforma: string;
  situacao: string;
  titulo: string;
  orgao: string;
  uf: string;
  municipio: string;
  modalidade: string;
  valor_estimado: number | null;
  data_abertura_proposta: string | null;
  data_encerramento_proposta: string | null;
  link_origem: string | null;
  etapa: string | null;
};

export default async function MinhasLicitacoesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("saved_licitacoes")
    .select("*")
    .order("created_at", { ascending: false });

  const licitacoes = (data ?? []) as SavedLicitacao[];
  const total = licitacoes.length;

  // Agrupa por etapa do funil
  const porEtapa = new Map<string, SavedLicitacao[]>();
  for (const l of licitacoes) {
    const etapa = l.etapa ?? ETAPA_PADRAO;
    const lista = porEtapa.get(etapa) ?? [];
    lista.push(l);
    porEtapa.set(etapa, lista);
  }

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
          {ETAPAS_LICITACAO.map((etapa) => {
            const itens = porEtapa.get(etapa.slug) ?? [];
            return (
              <GrupoEtapa
                key={etapa.slug}
                titulo={etapa.nome}
                descricao={etapa.descricao}
                quantidade={itens.length}
              >
                {itens.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                    Nenhuma licitação nesta etapa.
                  </p>
                ) : (
                  itens.map((item) => (
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
                      action={
                        <div className="flex items-center gap-1.5">
                          <CriarPropostaDialog licitacaoId={item.id} size="sm" compacto />
                          <EtapaSelect id={item.id} etapa={(item.etapa ?? ETAPA_PADRAO) as EtapaSlug} />
                          <RemoverLicitacaoButton id={item.id} />
                        </div>
                      }
                    />
                  ))
                )}
              </GrupoEtapa>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GrupoEtapa({
  titulo,
  descricao,
  quantidade,
  children,
}: {
  titulo: string;
  descricao: string;
  quantidade: number;
  children: React.ReactNode;
}) {
  return (
    <details open className="group rounded-xl border bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 [details[open]_&]:rotate-90" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{titulo}</p>
          <p className="truncate text-xs text-muted-foreground">{descricao}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 font-medium tabular-nums">
          {quantidade}
        </Badge>
      </summary>
      <div className="flex flex-col gap-3 border-t p-3">{children}</div>
    </details>
  );
}
