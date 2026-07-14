import { FileText, FileCheck2, FileClock, FileX2, FileQuestion, CircleHelp, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/format";
import {
  CHECKLIST_DOCUMENTOS,
  GRUPOS_DOCUMENTOS,
  TIPO_AVULSO,
  avaliarValidade,
  nomeTipo,
  tipoSemValidade,
  type Documento,
  type StatusValidade,
} from "@/lib/documentos/types";
import { UploadDocumento, DocumentoAcoes, BaixarGrupo } from "@/components/documentos-client";

export default async function DocumentosPage() {
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("documentos")
    .select("*")
    .order("created_at", { ascending: false });

  const documentos = (docs ?? []) as Documento[];

  // URLs assinadas para visualização (1h)
  const urls = new Map<string, string>();
  await Promise.all(
    documentos.map(async (d) => {
      const { data } = await supabase.storage
        .from("documentos")
        .createSignedUrl(d.arquivo_path, 3600);
      if (data?.signedUrl) urls.set(d.id, data.signedUrl);
    }),
  );

  // Documento mais recente por tipo do checklist
  const porTipo = new Map<string, Documento>();
  for (const d of documentos) {
    if (!porTipo.has(d.tipo)) porTipo.set(d.tipo, d);
  }
  const avulsos = documentos.filter((d) => d.tipo === TIPO_AVULSO);

  const totalChecklist = CHECKLIST_DOCUMENTOS.length;
  const enviados = CHECKLIST_DOCUMENTOS.filter((t) => porTipo.has(t.slug)).length;
  const vencidos = documentos.filter(
    (d) => !tipoSemValidade(d.tipo) && avaliarValidade(d.data_validade).status === "vencido",
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reúna aqui as certidões e documentos de habilitação para gerar propostas. A validade
            é verificada pela data de cada documento.
          </p>
        </div>
        <UploadDocumento />
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ResumoCard rotulo="Checklist enviado" valor={`${enviados} / ${totalChecklist}`} />
        <ResumoCard rotulo="Documentos vencidos" valor={String(vencidos)} alerta={vencidos > 0} />
        <ResumoCard rotulo="Total de arquivos" valor={String(documentos.length)} />
      </div>

      {/* Grupos do checklist (recolhíveis) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Checklist de habilitação
        </h2>
        {GRUPOS_DOCUMENTOS.map((grupo) => {
          const enviadosGrupo = grupo.tipos.filter((t) => porTipo.has(t.slug)).length;
          return (
            <Grupo
              key={grupo.slug}
              titulo={grupo.titulo}
              descricao={grupo.descricao}
              enviados={enviadosGrupo}
              total={grupo.tipos.length}
              slug={grupo.slug}
            >
              {grupo.tipos.map((tipo) => {
                const doc = porTipo.get(tipo.slug);
                return doc ? (
                  <LinhaDocumento key={tipo.slug} doc={doc} url={urls.get(doc.id) ?? null} subtitulo={tipo.descricao} />
                ) : (
                  <LinhaPendente key={tipo.slug} tipo={tipo.slug} nome={tipo.nome} descricao={tipo.descricao} />
                );
              })}
            </Grupo>
          );
        })}
      </section>

      {/* Outros documentos (avulsos) */}
      <Grupo titulo="Outros documentos" descricao="Arquivos fora do checklist" enviados={avulsos.length} slug={TIPO_AVULSO}>
        <div className="flex justify-end">
          <UploadDocumento variant="outline" size="sm" label="Adicionar avulso" />
        </div>
        {avulsos.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum documento avulso ainda.
          </p>
        ) : (
          avulsos.map((doc) => <LinhaDocumento key={doc.id} doc={doc} url={urls.get(doc.id) ?? null} />)
        )}
      </Grupo>
    </div>
  );
}

function Grupo({
  titulo,
  descricao,
  enviados,
  total,
  slug,
  children,
}: {
  titulo: string;
  descricao: string;
  enviados: number;
  total?: number;
  slug?: string;
  children: React.ReactNode;
}) {
  const completo = total != null && enviados >= total;
  return (
    <details className="group rounded-xl border bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 [details[open]_&]:rotate-90" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{titulo}</p>
          <p className="truncate text-xs text-muted-foreground">{descricao}</p>
        </div>
        {slug && enviados > 0 && <BaixarGrupo slug={slug} />}
        <Badge
          variant="secondary"
          className={`shrink-0 font-medium tabular-nums ${completo ? "bg-primary/12 text-primary" : ""}`}
        >
          {total != null ? `${enviados}/${total}` : enviados}
        </Badge>
      </summary>
      <div className="flex flex-col gap-2 border-t px-3 py-3">{children}</div>
    </details>
  );
}

function ResumoCard({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-1 py-1">
        <span className="text-xs text-muted-foreground">{rotulo}</span>
        <span className={`text-xl font-semibold ${alerta ? "text-destructive" : ""}`}>{valor}</span>
      </CardContent>
    </Card>
  );
}

const STATUS_STYLE: Record<StatusValidade, { badge: string; icon: typeof FileCheck2 }> = {
  valido: { badge: "border-transparent bg-primary/12 text-primary", icon: FileCheck2 },
  vence_em_breve: { badge: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400", icon: FileClock },
  vencido: { badge: "border-transparent bg-destructive/12 text-destructive", icon: FileX2 },
  sem_data: { badge: "border-transparent bg-muted text-muted-foreground", icon: FileQuestion },
};

function LinhaDocumento({ doc, url, subtitulo }: { doc: Documento; url: string | null; subtitulo?: string }) {
  const semValidade = tipoSemValidade(doc.tipo);
  const validade = avaliarValidade(doc.data_validade);
  const style = STATUS_STYLE[validade.status];
  const Icon = semValidade ? FileCheck2 : style.icon;

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-background px-3 py-2.5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{doc.nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {doc.tipo !== TIPO_AVULSO ? `${nomeTipo(doc.tipo)} · ` : ""}
          {subtitulo ?? doc.arquivo_nome}
        </p>
      </div>
      {!semValidade && (
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-xs text-muted-foreground">Validade</p>
          <p className="text-sm font-medium tabular-nums">{formatarData(doc.data_validade)}</p>
        </div>
      )}
      {semValidade ? (
        <Badge variant="outline" className="shrink-0 gap-1 font-medium border-transparent bg-muted text-muted-foreground">
          Sem validade
        </Badge>
      ) : (
        <Badge variant="outline" className={`shrink-0 gap-1 font-medium ${style.badge}`}>
          {validade.rotulo}
          {doc.validade_automatica && validade.status !== "sem_data" && (
            <span title="Data detectada automaticamente do PDF" className="opacity-70">·auto</span>
          )}
        </Badge>
      )}
      <DocumentoAcoes
        id={doc.id}
        tipo={doc.tipo}
        nome={doc.nome}
        arquivoNome={doc.arquivo_nome}
        urlVisualizacao={url}
        dataValidade={doc.data_validade}
        semValidade={semValidade}
      />
    </div>
  );
}

function LinhaPendente({ tipo, nome, descricao }: { tipo: string; nome: string; descricao: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-dashed px-3 py-2.5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <FileText className="size-5 text-muted-foreground/60" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-muted-foreground">{nome}</p>
        <p className="truncate text-xs text-muted-foreground/70">{descricao}</p>
      </div>
      <Badge variant="outline" className="shrink-0 gap-1 font-normal text-muted-foreground">
        <CircleHelp className="size-3.5" />
        Pendente
      </Badge>
      <UploadDocumento tipoFixo={tipo} nomeSugerido={nome} variant="outline" size="sm" label="Enviar" />
    </div>
  );
}
