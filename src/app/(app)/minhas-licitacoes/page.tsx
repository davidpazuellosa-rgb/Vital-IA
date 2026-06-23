import Link from "next/link";
import { Bookmark, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PLATAFORMAS, ETAPAS_LICITACAO, normalizarEtapa, type EtapaSlug } from "@/lib/licitacoes/types";
import { LicitacaoCard } from "@/components/licitacao-card";
import { RemoverLicitacaoButton } from "@/components/remover-licitacao-button";
import { EtapaSelect } from "@/components/etapa-select";
import { CriarPropostaDialog } from "@/components/criar-proposta-dialog";
import { EtapasLicitacaoFilter } from "@/components/etapas-licitacao-filter";

const PLATAFORMA_NOME: Record<string, string> = Object.fromEntries(
  PLATAFORMAS.map((p) => [p.id, p.nome]),
);

type SavedLicitacao = {
  id: string;
  numero_controle_pncp: string;
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
  const serviceSupabase = createServiceClient();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  const { data } = await supabase
    .from("saved_licitacoes")
    .select("*")
    .order("created_at", { ascending: false });

  const licitacoes = (data ?? []) as SavedLicitacao[];
  const total = licitacoes.length;
  const idsLicitacoes = licitacoes.map((item) => item.id);
  const { data: propostas } = idsLicitacoes.length
    ? await supabase.from("propostas").select("licitacao_id").in("licitacao_id", idsLicitacoes)
    : { data: [] };
  const licitacoesComProposta = new Set((propostas ?? []).map((item) => String(item.licitacao_id)));

  const alertasIds = userId
    ? ((await serviceSupabase.from("alertas").select("id").eq("user_id", userId)).data ?? []).map((alerta) => String(alerta.id))
    : [];

  const enviosAlertas = alertasIds.length > 0
    ? (await serviceSupabase
        .from("alerta_envios")
        .select("numero_controle_pncp")
        .in("alerta_id", alertasIds)).data ?? []
    : [];

  const licitacoesSalvasPorAlerta = new Set(enviosAlertas.map((envio) => String(envio.numero_controle_pncp)));

  // Agrupa por etapa do funil
  const porEtapa = new Map<string, SavedLicitacao[]>();
  for (const l of licitacoes) {
    const etapa = normalizarEtapa(l.etapa);
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
        <EtapasLicitacaoFilter
          etapas={ETAPAS_LICITACAO.map((etapa) => {
            const itens = porEtapa.get(etapa.slug) ?? [];
            return {
              slug: etapa.slug,
              nome: etapa.nome,
              descricao: etapa.descricao,
              quantidade: itens.length,
              conteudo: itens.length === 0 ? (
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
                      numeroControlePNCP={item.numero_controle_pncp}
                    salvoPorAlerta={licitacoesSalvasPorAlerta.has(item.numero_controle_pncp)}
                      action={
                        <div className="flex items-center gap-1.5">
                          <CriarPropostaDialog licitacaoId={item.id} temPropostaInicial={licitacoesComProposta.has(item.id)} size="sm" compacto />
                          <EtapaSelect id={item.id} etapa={normalizarEtapa(item.etapa) as EtapaSlug} />
                          <RemoverLicitacaoButton id={item.id} />
                        </div>
                      }
                    />
                  ))
                ),
            };
          })}
        />
      )}
    </div>
  );
}
