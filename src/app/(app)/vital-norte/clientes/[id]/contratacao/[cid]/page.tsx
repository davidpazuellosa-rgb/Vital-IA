import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/format";
import { CATEGORIAS_CONTRATACAO, type Contratacao, type ClienteDocumento } from "@/lib/clientes/types";
import { ClienteDocUpload, ClienteDocAcoes, RemoverContratacaoButton, ContratacaoStatus } from "@/components/clientes-client";

export default async function ContratacaoPage({ params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params;
  const supabase = await createClient();

  const { data: cont } = await supabase.from("contratacoes").select("*").eq("id", cid).single();
  if (!cont || cont.cliente_id !== id) notFound();
  const ct = cont as Contratacao;

  const { data: docsData } = await supabase
    .from("cliente_documentos")
    .select("*")
    .eq("contratacao_id", cid)
    .order("created_at", { ascending: false });
  const docs = (docsData ?? []) as ClienteDocumento[];

  const urls = new Map<string, string>();
  await Promise.all(
    docs.map(async (d) => {
      const { data } = await supabase.storage.from("documentos").createSignedUrl(d.arquivo_path, 3600);
      if (data?.signedUrl) urls.set(d.id, data.signedUrl);
    }),
  );

  const porCategoria = (slug: string) => docs.filter((d) => d.tipo === slug);
  const avulsos = docs.filter((d) => !CATEGORIAS_CONTRATACAO.some((cat) => cat.slug === d.tipo));

  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="w-fit gap-1.5 px-2 text-muted-foreground">
        <Link href={`/vital-norte/clientes/${id}`}><ArrowLeft className="size-4" /> Voltar ao cliente</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{ct.titulo}</h1>
          {ct.identificador && <p className="text-sm text-muted-foreground">{ct.identificador}</p>}
        </div>
        <RemoverContratacaoButton id={ct.id} clienteId={id} />
      </div>

      <Card className="shadow-sm">
        <CardContent>
          <ContratacaoStatus id={ct.id} clienteId={id} status={ct.status ?? ""} proximoPasso={ct.proximo_passo ?? ""} />
        </CardContent>
      </Card>

      {CATEGORIAS_CONTRATACAO.map((cat) => {
        const lista = porCategoria(cat.slug);
        return (
          <Card key={cat.slug} className="shadow-sm">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{cat.nome}</h2>
                  <p className="text-xs text-muted-foreground">{cat.descricao}</p>
                </div>
                <ClienteDocUpload clienteId={id} contratacaoId={ct.id} tipo={cat.slug} />
              </div>
              {lista.length === 0 ? (
                <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                  Nenhum documento.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {lista.map((d) => (
                    <LinhaDoc key={d.id} doc={d} clienteId={id} contratacaoId={ct.id} url={urls.get(d.id) ?? null} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {avulsos.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Outros documentos</h2>
              <ClienteDocUpload clienteId={id} contratacaoId={ct.id} tipo="avulso" />
            </div>
            <div className="flex flex-col gap-2">
              {avulsos.map((d) => (
                <LinhaDoc key={d.id} doc={d} clienteId={id} contratacaoId={ct.id} url={urls.get(d.id) ?? null} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LinhaDoc({ doc, clienteId, contratacaoId, url }: { doc: ClienteDocumento; clienteId: string; contratacaoId: string; url: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileText className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{doc.nome}</p>
        <p className="truncate text-xs text-muted-foreground">{doc.arquivo_nome}</p>
      </div>
      <Badge variant="secondary" className="hidden shrink-0 font-normal tabular-nums sm:inline-flex">
        {formatarData(doc.created_at)}
      </Badge>
      <ClienteDocAcoes id={doc.id} clienteId={clienteId} contratacaoId={contratacaoId} url={url} />
    </div>
  );
}
