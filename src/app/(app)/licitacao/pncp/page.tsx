import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, ExternalLink, Wallet, CalendarClock, Activity, Building2, MapPin, Gavel } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarData, formatarMoeda } from "@/lib/format";
import { buscarCompraPncp, buscarItensPncp } from "@/lib/licitacoes/providers/pncp-itens";
import { SalvarLicitacaoButton } from "@/components/salvar-licitacao-button";

export default async function LicitacaoPncpPerfil({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const { n } = await searchParams;
  if (!n) notFound();

  const [lic, itens] = await Promise.all([buscarCompraPncp(n), buscarItensPncp(n)]);
  if (!lic) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-2 text-muted-foreground">
        <Link href="/busca"><ArrowLeft className="size-4" /> Busca</Link>
      </Button>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        {/* Coluna principal */}
        <div className="flex flex-col gap-4">
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="font-normal">PNCP (Nacional)</Badge>
                {lic.situacao && <Badge variant="outline" className="font-normal">{lic.situacao}</Badge>}
              </div>
              <h1 className="text-lg font-semibold leading-tight tracking-tight">{lic.titulo || lic.orgao}</h1>
              <p className="text-xs text-muted-foreground">{lic.numeroControlePNCP}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-3">
                <Campo icon={Building2} rotulo="Órgão" valor={lic.orgao || "—"} />
                <Campo icon={MapPin} rotulo="Local" valor={`${lic.municipio || "—"} / ${lic.uf || "—"}`} />
                <Campo icon={Gavel} rotulo="Modalidade" valor={lic.modalidade || "—"} />
                <Campo icon={Wallet} rotulo="Valor estimado" valor={formatarMoeda(lic.valorEstimado)} />
                <Campo icon={CalendarClock} rotulo="Encerramento" valor={formatarData(lic.dataEncerramentoProposta)} destaque />
                <Campo icon={Activity} rotulo="Abertura" valor={formatarData(lic.dataAberturaProposta)} />
              </div>
              {lic.descricao && lic.descricao !== lic.titulo && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">Objeto</p>
                  <p className="mt-0.5 text-sm">{lic.descricao}</p>
                </div>
              )}
              {lic.linkOrigem && (
                <a href={lic.linkOrigem} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  <ExternalLink className="size-3.5" /> Ver no sistema de origem
                </a>
              )}
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

        {/* Coluna direita: ação */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20">
          <Card className="shadow-sm">
            <CardContent className="flex flex-col gap-3">
              <SalvarLicitacaoButton licitacao={lic} />
              <p className="text-xs text-muted-foreground">
                Salve para acompanhar em Minhas Licitações e gerar a proposta.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Campo({ icon: Icon, rotulo, valor, destaque }: { icon: typeof MapPin; rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="size-3 shrink-0" /> {rotulo}
      </span>
      <span className={`truncate text-sm font-medium ${destaque ? "text-primary" : ""}`} title={valor}>{valor}</span>
    </div>
  );
}
