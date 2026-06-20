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
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/format";
import { RemoverLicitacaoButton } from "@/components/remover-licitacao-button";

export default async function MinhasLicitacoesPage() {
  const supabase = await createClient();
  const { data: licitacoes } = await supabase
    .from("saved_licitacoes")
    .select("*")
    .order("created_at", { ascending: false });

  if (!licitacoes || licitacoes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Você ainda não salvou nenhuma licitação. Use a página de Busca para encontrar e salvar.
      </p>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plataforma</TableHead>
              <TableHead>Órgão / Objeto</TableHead>
              <TableHead>UF / Município</TableHead>
              <TableHead>Modalidade</TableHead>
              <TableHead>Valor estimado</TableHead>
              <TableHead>Abertura</TableHead>
              <TableHead>Encerramento</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {licitacoes.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Badge variant="secondary">{item.plataforma}</Badge>
                </TableCell>
                <TableCell className="max-w-sm">
                  <div className="font-medium">{item.orgao}</div>
                  <div className="text-sm text-muted-foreground line-clamp-2">{item.titulo}</div>
                </TableCell>
                <TableCell>
                  {item.municipio} / {item.uf}
                </TableCell>
                <TableCell>{item.modalidade}</TableCell>
                <TableCell>{formatarMoeda(item.valor_estimado)}</TableCell>
                <TableCell>{formatarData(item.data_abertura_proposta)}</TableCell>
                <TableCell>{formatarData(item.data_encerramento_proposta)}</TableCell>
                <TableCell>{item.situacao}</TableCell>
                <TableCell>
                  <RemoverLicitacaoButton id={item.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
