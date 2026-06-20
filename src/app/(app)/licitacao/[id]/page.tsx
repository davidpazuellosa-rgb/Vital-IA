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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/format";
import { PLATAFORMAS } from "@/lib/licitacoes/types";
import { buscarItensPncp } from "@/lib/licitacoes/providers/pncp-itens";
import { LicitacaoAcoes } from "@/components/licitacao-acoes";

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

  const itens = await buscarItensPncp(lic.numero_controle_pncp);
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
              {lic.link_origem && (
                <a
                  href={lic.link_origem}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Sistema de origem
                </a>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-4">
              <SecaoTitulo>Sobre esta licitação</SecaoTitulo>
              <Campo rotulo="Objeto" valor={lic.titulo} />
              <Campo rotulo="Órgão" valor={lic.orgao} />
              <Campo rotulo="Plataforma" valor={PLATAFORMA_NOME[lic.plataforma] ?? lic.plataforma} />
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
              {itens.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Não foi possível carregar os itens desta licitação no PNCP.
                </p>
              ) : (
                <div className="[&_[data-slot=table-container]]:overflow-visible">
                  <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8 pl-5">#</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead>Unid.</TableHead>
                      <TableHead className="text-right">Vlr. unitário</TableHead>
                      <TableHead className="pr-5 text-right">Vlr. total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item) => (
                      <TableRow key={item.numeroItem}>
                        <TableCell className="pl-5 align-top text-muted-foreground">{item.numeroItem}</TableCell>
                        <TableCell className="w-full whitespace-normal align-top leading-snug">{item.descricao}</TableCell>
                        <TableCell className="align-top text-right tabular-nums">{item.quantidade ?? "—"}</TableCell>
                        <TableCell className="align-top text-muted-foreground">{item.unidadeMedida || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap align-top text-right tabular-nums">{formatarMoeda(item.valorUnitarioEstimado)}</TableCell>
                        <TableCell className="whitespace-nowrap pr-5 align-top text-right tabular-nums">{formatarMoeda(item.valorTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== Coluna direita: ações + resumo ===== */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <Card className="shadow-sm">
            <CardContent>
              <LicitacaoAcoes itens={itens} numeroControle={lic.numero_controle_pncp} licitacaoId={id} />
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
