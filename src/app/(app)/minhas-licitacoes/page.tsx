import Link from "next/link";
import { Bookmark, Clock, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PLATAFORMAS, ETAPAS_LICITACAO, normalizarEtapa, type EtapaSlug } from "@/lib/licitacoes/types";
import { MinhasLicitacoesClient, type ItemMinhas } from "@/components/minhas-licitacoes-client";
import { RemoverLicitacaoButton } from "@/components/remover-licitacao-button";
import { EtapaSelect } from "@/components/etapa-select";
import { CriarPropostaDialog } from "@/components/criar-proposta-dialog";
import { EnvioPropostaDialog } from "@/components/envio-proposta-dialog";
import { Badge } from "@/components/ui/badge";
import { COR_NIVEL_PRAZO, prazoDe } from "@/lib/propostas/prazo";

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

/** Página renderizada no servidor a cada requisição: a hora atual é a da requisição. */
function horaAtual(): number {
  return Date.now();
}

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
    ? await supabase.from("propostas").select("licitacao_id, status").in("licitacao_id", idsLicitacoes)
    : { data: [] };
  const licitacoesComProposta = new Set((propostas ?? []).map((item) => String(item.licitacao_id)));
  const licitacoesEnviadas = new Set(
    (propostas ?? []).filter((item) => item.status === "enviada").map((item) => String(item.licitacao_id)),
  );

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

  // Propostas em andamento: proposta pronta (ou rascunho começado), ainda não enviada e com prazo aberto.
  const agora = horaAtual();
  const emAndamento = licitacoes
    .filter((l) => {
      if (licitacoesEnviadas.has(l.id)) return false;
      const etapa = normalizarEtapa(l.etapa);
      if (etapa !== "proposta_pronta" && !(etapa === "oportunidade" && licitacoesComProposta.has(l.id))) return false;
      return !l.data_encerramento_proposta || new Date(l.data_encerramento_proposta).getTime() > agora;
    })
    .sort((a, b) => {
      const ta = a.data_encerramento_proposta ? new Date(a.data_encerramento_proposta).getTime() : Infinity;
      const tb = b.data_encerramento_proposta ? new Date(b.data_encerramento_proposta).getTime() : Infinity;
      return ta - tb;
    });

  return (
    <div className="flex flex-col gap-5">

      {emAndamento.length > 0 && (
        <Card className="border-primary/30">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Propostas em andamento <span className="font-normal text-muted-foreground">· {emAndamento.length} sem envio registrado, por prazo</span></h2>
            </div>
            <ul className="divide-y">
              {emAndamento.map((l) => {
                const prazo = prazoDe(l.data_encerramento_proposta, agora);
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
                    <Badge variant="outline" className={`shrink-0 gap-1 font-medium ${COR_NIVEL_PRAZO[prazo.nivel]}`}>{prazo.texto}</Badge>
                    <Link href={`/licitacao/${l.id}`} className="min-w-0 flex-1 hover:underline">
                      <p className="truncate text-sm font-medium">{l.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">{l.orgao} · {l.uf}</p>
                    </Link>
                    <EnvioPropostaDialog licitacaoId={l.id} size="sm" />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {total === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bookmark className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Nenhuma licitação salva ainda</p>
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
        <MinhasLicitacoesClient
          etapas={ETAPAS_LICITACAO.map((etapa) => ({ slug: etapa.slug, nome: etapa.nome, descricao: etapa.descricao }))}
          plataformas={PLATAFORMA_NOME}
          itens={licitacoes.map((item): ItemMinhas => ({
            etapa: normalizarEtapa(item.etapa),
            plataformaId: item.plataforma,
            temProposta: licitacoesComProposta.has(item.id),
            item: {
              id: item.id,
              href: `/licitacao/${item.id}`,
              plataformaNome: PLATAFORMA_NOME[item.plataforma] ?? item.plataforma,
              situacao: item.situacao,
              titulo: item.titulo,
              orgao: item.orgao,
              uf: item.uf,
              municipio: item.municipio,
              modalidade: item.modalidade,
              valorEstimado: item.valor_estimado,
              dataAbertura: item.data_abertura_proposta,
              dataEncerramento: item.data_encerramento_proposta,
              linkOrigem: item.link_origem,
              numeroControlePNCP: item.numero_controle_pncp,
              salvoPorAlerta: licitacoesSalvasPorAlerta.has(item.numero_controle_pncp),
              action: (
                <div className="flex items-center gap-1.5">
                  <CriarPropostaDialog licitacaoId={item.id} temPropostaInicial={licitacoesComProposta.has(item.id)} size="sm" compacto />
                  <EnvioPropostaDialog licitacaoId={item.id} enviada={licitacoesEnviadas.has(item.id)} size="sm" compacto />
                  <EtapaSelect id={item.id} etapa={normalizarEtapa(item.etapa) as EtapaSlug} />
                  <RemoverLicitacaoButton id={item.id} />
                </div>
              ),
            },
          }))}
        />
      )}
    </div>
  );
}
