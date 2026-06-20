import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Truck,
  CalendarPlus,
  CalendarClock,
  Wallet,
  Package,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-2 text-muted-foreground">
          <Link href="/minhas-licitacoes">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            {PLATAFORMA_NOME[lic.plataforma] ?? lic.plataforma}
          </Badge>
          {lic.situacao && (
            <Badge variant="outline" className="font-normal">{lic.situacao}</Badge>
          )}
          <span className="text-xs text-muted-foreground">{lic.numero_controle_pncp}</span>
        </div>
        <h1 className="text-xl font-semibold leading-snug tracking-tight">{lic.titulo}</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr_15rem]">
        {/* Esquerda: licitante, entrega, valor */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-primary" />
                Licitante
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Info rotulo="Órgão" valor={lic.orgao} />
              <Info rotulo="Modalidade" valor={lic.modalidade} />
              <Info rotulo="Esfera" valor={esferaNome(lic)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="size-4 text-primary" />
                Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Info icon={MapPin} rotulo="Local" valor={`${lic.municipio || "—"} / ${lic.uf || "—"}`} />
              <Info icon={CalendarPlus} rotulo="Abertura das propostas" valor={formatarData(lic.data_abertura_proposta)} />
              <Info icon={CalendarClock} rotulo="Encerramento das propostas" valor={formatarData(lic.data_encerramento_proposta)} destaque />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="size-4 text-primary" />
                Valor total
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Info rotulo="Valor estimado" valor={formatarMoeda(lic.valor_estimado)} destaque />
              {itens.length > 0 && (
                <Info rotulo="Soma dos itens" valor={formatarMoeda(valorItens)} />
              )}
              {lic.link_origem && (
                <a
                  href={lic.link_origem}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
                >
                  Ver no sistema de origem
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Meio: itens */}
        <Card className="py-0">
          <CardContent className="px-0">
            <div className="flex items-center gap-2 border-b px-5 py-3">
              <Package className="size-4 text-primary" />
              <span className="font-medium">Itens</span>
              <Badge variant="secondary" className="ml-1 font-normal">{itens.length}</Badge>
            </div>
            {itens.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Não foi possível carregar os itens desta licitação no PNCP.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12 pl-5">#</TableHead>
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
                        <TableCell className="pl-5 text-muted-foreground">{item.numeroItem}</TableCell>
                        <TableCell className="min-w-[16rem] max-w-md">{item.descricao}</TableCell>
                        <TableCell className="text-right tabular-nums">{item.quantidade ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.unidadeMedida || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{formatarMoeda(item.valorUnitarioEstimado)}</TableCell>
                        <TableCell className="whitespace-nowrap pr-5 text-right tabular-nums">{formatarMoeda(item.valorTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Direita: ações */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent>
              <LicitacaoAcoes itens={itens} numeroControle={lic.numero_controle_pncp} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function esferaNome(lic: { plataforma: string }): string {
  // Esfera não é armazenada; derivada da plataforma quando aplicável.
  if (lic.plataforma === "comprasnet") return "Federal";
  if (lic.plataforma === "ecompras-am") return "Estadual (AM)";
  if (lic.plataforma === "compras-manaus") return "Municipal (Manaus)";
  return "—";
}

function Info({
  icon: Icon,
  rotulo,
  valor,
  destaque,
}: {
  icon?: typeof MapPin;
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3 shrink-0" />}
        {rotulo}
      </span>
      <span className={destaque ? "font-semibold text-primary" : "font-medium"}>{valor}</span>
    </div>
  );
}
