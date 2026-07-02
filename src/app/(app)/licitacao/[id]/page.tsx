import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Package,
  ExternalLink,
  Wallet,
  CalendarClock,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/format";
import { normalizarEtapa, PLATAFORMAS } from "@/lib/licitacoes/types";
import { buscarItensPncp } from "@/lib/licitacoes/providers/pncp-itens";
import { buscarArquivosPncp } from "@/lib/licitacoes/providers/pncp-arquivos";
import { linkPncp } from "@/lib/licitacoes/pncp-url";
import { LicitacaoAcoes } from "@/components/licitacao-acoes";
import { LicitacaoItensTabela } from "@/components/licitacao-itens-tabela";

export const maxDuration = 300;

const PLATAFORMA_NOME: Record<string, string> = Object.fromEntries(
  PLATAFORMAS.map((p) => [p.id, p.nome]),
);

export default async function LicitacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: lic } = await supabase
    .from("saved_licitacoes")
    .select("*")
    .eq("id", id)
    .single();

  if (!lic) notFound();

  const { data: propostaExistente } = await supabase
    .from("propostas")
    .select("id")
    .eq("licitacao_id", id)
    .maybeSingle();
  const [itens, arquivosEdital] = await Promise.all([
    buscarItensPncp(lic.numero_controle_pncp),
    buscarArquivosPncp(lic.numero_controle_pncp),
  ]);
  const valorItens = itens.reduce((s, i) => s + (i.valorTotal ?? 0), 0);
  const iniciais = (lic.orgao || "LI").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      {/* Topo */}
      <div>
        <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-2 text-muted-foreground">
          <Link href="/minhas-licitacoes">
            <ArrowLeft className="size-4" />
            Licitações
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[19rem_minmax(0,1fr)_16rem]">
        {/* ===== Coluna esquerda: identidade + "Sobre" ===== */}
        <div className="flex flex-col gap-4">
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-base font-semibold text-primary-foreground">
                  {iniciais}
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold leading-tight tracking-tight">{lic.orgao}</h1>
                  <p className="mt-0.5 text-xs text-muted-foreground">{lic.numero_controle_pncp}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="font-normal">
                  {PLATAFORMA_NOME[lic.plataforma] ?? lic.plataforma}
                </Badge>
                {lic.situacao && (
                  <Badge variant="outline" className="font-normal">{lic.situacao}</Badge>
                )}
              </div>
              {(linkPncp(lic.numero_controle_pncp) ?? lic.link_origem) && (
                <a
                  href={linkPncp(lic.numero_controle_pncp) ?? lic.link_origem!}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  {linkPncp(lic.numero_controle_pncp) ? "Ver no PNCP" : "Sistema de origem"}
                </a>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-4">
              <SecaoTitulo>Sobre esta licitação</SecaoTitulo>
              <Campo rotulo="Objeto" valor={lic.titulo} />
              <Campo rotulo="Órgão" valor={lic.orgao} />
              <Campo rotulo="Modalidade" valor={lic.modalidade || "—"} />
              <Campo rotulo="Esfera" valor={esferaNome(lic)} />
              <Campo rotulo="Estado" valor={lic.uf || "—"} />
              <Campo rotulo="Município" valor={lic.municipio || "—"} />
              <Campo rotulo="Situação" valor={lic.situacao || "—"} />
              <Campo rotulo="Abertura das propostas" valor={formatarData(lic.data_abertura_proposta)} />
              <Campo rotulo="Encerramento das propostas" valor={formatarData(lic.data_encerramento_proposta)} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-3">
              <SecaoTitulo>Resumo financeiro</SecaoTitulo>
              <Campo rotulo="Valor estimado" valor={formatarMoeda(lic.valor_estimado)} destaque />
              {itens.length > 0 && (
                <>
                  <Campo rotulo="Soma dos itens" valor={formatarMoeda(valorItens)} />
                  <Campo rotulo="Quantidade de itens" valor={String(itens.length)} />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== Coluna do meio: destaques + itens ===== */}
        <div className="flex flex-col gap-4">
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-4">
              <SecaoTitulo>Destaques de dados</SecaoTitulo>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Destaque icon={Wallet} rotulo="Valor estimado" valor={formatarMoeda(lic.valor_estimado)} />
                <Destaque
                  icon={CalendarClock}
                  rotulo="Encerramento"
                  valor={formatarData(lic.data_encerramento_proposta)}
                  destaque
                />
                <Destaque icon={Activity} rotulo="Situação" valor={lic.situacao || "—"} />
              </div>
            </CardContent>
          </Card>

          <Card className="py-0 shadow-sm">
            <CardContent className="px-0">
              <div className="flex items-center gap-2 border-b px-5 py-3.5">
                <Package className="size-4 text-primary" />
                <span className="font-semibold">Itens</span>
                <Badge variant="secondary" className="ml-1 font-normal">{itens.length}</Badge>
              </div>
              <LicitacaoItensTabela itens={itens} />
            </CardContent>
          </Card>
        </div>

        {/* ===== Coluna direita: ações + resumo ===== */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <Card className="shadow-sm">
            <CardContent>
              <LicitacaoAcoes itens={itens} numeroControle={lic.numero_controle_pncp} licitacaoId={id} etapa={normalizarEtapa(lic.etapa)} orgao={lic.orgao} uf={lic.uf} esfera={esferaNome(lic).split(" ")[0]} arquivosEdital={arquivosEdital.map((a) => ({ titulo: a.titulo, url: a.url }))} temProposta={Boolean(propostaExistente)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function esferaNome(lic: { plataforma: string }): string {
  if (lic.plataforma === "comprasnet") return "Federal";
  if (lic.plataforma === "ecompras-am") return "Estadual (AM)";
  if (lic.plataforma === "compras-manaus") return "Municipal (Manaus)";
  return "—";
}

function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <ChevronDown className="size-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold">{children}</h2>
    </div>
  );
}

function Campo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <span className={destaque ? "text-sm font-semibold text-primary" : "text-sm font-medium"}>
        {valor}
      </span>
    </div>
  );
}

function Destaque({
  icon: Icon,
  rotulo,
  valor,
  destaque,
}: {
  icon: typeof Wallet;
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {rotulo}
      </span>
      <span className={destaque ? "text-base font-semibold text-primary" : "text-base font-semibold"}>
        {valor}
      </span>
    </div>
  );
}
