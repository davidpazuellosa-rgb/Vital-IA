import Link from "next/link";
import { Bookmark, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/format";
import { PLATAFORMAS } from "@/lib/licitacoes/types";
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
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Plataforma</TableHead>
                  <TableHead>Órgão / Objeto</TableHead>
                  <TableHead>UF / Município</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead className="text-right">Valor estimado</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Encerramento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {licitacoes!.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="pl-6">
                      <Badge variant="secondary" className="font-normal">
                        {PLATAFORMA_NOME[item.plataforma] ?? item.plataforma}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <div className="font-medium">{item.orgao}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">{item.titulo}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {item.municipio} / {item.uf}
                    </TableCell>
                    <TableCell className="text-sm">{item.modalidade}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatarMoeda(item.valor_estimado)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatarData(item.data_abertura_proposta)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatarData(item.data_encerramento_proposta)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">{item.situacao}</Badge>
                    </TableCell>
                    <TableCell className="pr-6">
                      <RemoverLicitacaoButton id={item.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
