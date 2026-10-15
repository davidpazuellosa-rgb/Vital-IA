import { FileText, FileCheck2, FileClock, FileX2, FileQuestion, CircleHelp, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/format";
import {
  CHECKLIST_DOCUMENTOS,
  GRUPOS_DOCUMENTOS,
  TIPO_AVULSO,
  TODOS_TIPOS,
  tiposDoGrupo,
  avaliarValidade,
  nomeTipo,
  tipoSemValidade,
  type Documento,
  type StatusValidade,
} from "@/lib/documentos/types";
import { UploadDocumento, DocumentoAcoes, BaixarGrupo } from "@/components/documentos-client";
import { CardVencidos } from "@/components/card-vencidos";
import { configEmpresa, type EmpresaSlug } from "@/lib/empresas";

/** Página de Documentos de uma empresa (padrão: Vital Norte). A RM usa tabelas e pasta próprias. */
export async function DocumentosPagina({ empresa }: { empresa?: EmpresaSlug }) {
  const cfg = configEmpresa(empresa);
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from(cfg.tabelaDocumentos)
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

  // TODOS os documentos de cada tipo (podem ser vários; o mais recente vem primeiro)
  const porTipo = new Map<string, Documento[]>();
  for (const d of documentos) porTipo.set(d.tipo, [...(porTipo.get(d.tipo) ?? []), d]);
  // Avulsos e documentos de tipo desconhecido (nunca somem da tela)
  const conhecidos = new Set(TODOS_TIPOS.map((t) => t.slug));
  const avulsos = documentos.filter((d) => d.tipo === TIPO_AVULSO || !conhecidos.has(d.tipo));

  const totalChecklist = CHECKLIST_DOCUMENTOS.length;
  const enviados = CHECKLIST_DOCUMENTOS.filter((t) => porTipo.has(t.slug)).length;
  const vencidosDe = (tipos: (d: Documento) => boolean) =>
    documentos.filter((d) => tipos(d) && !tipoSemValidade(d.tipo) && avaliarValidade(d.data_validade).status === "vencido").length;
  // vencidos, do mais antigo para o mais recente (o card abre o primeiro e vai passando)
  const idsVencidos = documentos
    .filter((d) => !tipoSemValidade(d.tipo) && avaliarValidade(d.data_validade).status === "vencido")
    .sort((a, b) => String(a.data_validade).localeCompare(String(b.data_validade)))
    .map((d) => d.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-end gap-4">
        <UploadDocumento empresa={empresa} />
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ResumoCard rotulo="Checklist enviado" valor={`${enviados} / ${totalChecklist}`} />
        <CardVencidos ids={idsVencidos} />
        <ResumoCard rotulo="Total de arquivos" valor={String(documentos.length)} />
      </div>

      {/* Grupos do checklist (recolhíveis) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Checklist de habilitação
        </h2>
        {GRUPOS_DOCUMENTOS.map((grupo) => {
          const enviadosGrupo = grupo.tipos.filter((t) => porTipo.has(t.slug)).length;
          const extras = porTipo.get(grupo.extra.slug) ?? [];
          const arquivosGrupo = [...grupo.tipos.map((t) => t.slug), grupo.extra.slug].reduce((s, t) => s + (porTipo.get(t)?.length ?? 0), 0);
          return (
            <Grupo
              key={grupo.slug}
              titulo={grupo.titulo}
              enviados={enviadosGrupo}
              total={grupo.tipos.length}
              arquivos={arquivosGrupo}
              vencidos={vencidosDe((d) => tiposDoGrupo(grupo).includes(d.tipo))}
              slug={grupo.slug}
              empresa={empresa}
            >
              {grupo.tipos.map((tipo) => {
                const docsDoTipo = porTipo.get(tipo.slug) ?? [];
                return docsDoTipo.length ? (
                  docsDoTipo.map((doc) => <LinhaDocumento key={doc.id} doc={doc} url={urls.get(doc.id) ?? null} empresa={empresa} />)
                ) : (
                  <LinhaPendente key={tipo.slug} tipo={tipo.slug} nome={tipo.nome} empresa={empresa} />
                );
              })}
              {extras.map((doc) => <LinhaDocumento key={doc.id} doc={doc} url={urls.get(doc.id) ?? null} empresa={empresa} />)}
              <div className="flex justify-end">
                <UploadDocumento empresa={empresa} tipoFixo={grupo.extra.slug} nomeSugerido="" variant="outline" size="sm" label={`Adicionar em ${grupo.titulo}`} />
              </div>
            </Grupo>
          );
        })}
      </section>

      {/* Outros documentos (avulsos) */}
      <Grupo titulo="Outros documentos" enviados={avulsos.length} vencidos={vencidosDe((d) => d.tipo === TIPO_AVULSO || !conhecidos.has(d.tipo))} slug={TIPO_AVULSO} empresa={empresa}>
        <div className="flex justify-end">
          <UploadDocumento empresa={empresa} variant="outline" size="sm" label="Adicionar avulso" />
        </div>
        {avulsos.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum documento avulso ainda.
          </p>
        ) : (
          avulsos.map((doc) => <LinhaDocumento key={doc.id} doc={doc} url={urls.get(doc.id) ?? null} empresa={empresa} />)
        )}
      </Grupo>
    </div>
  );
}

function Grupo({
  titulo,
  enviados,
  total,
  arquivos,
  vencidos,
  slug,
  empresa,
  children,
}: {
  titulo: string;
  enviados: number;
  total?: number;
  /** Quantos arquivos há no grupo (pode passar do total de tipos: um tipo aceita vários). */
  arquivos?: number;
  /** Documentos vencidos neste grupo (bolinha vermelha). */
  vencidos?: number;
  slug?: string;
  empresa?: EmpresaSlug;
  children: React.ReactNode;
}) {
  const completo = total != null && enviados >= total;
  return (
    <details className="group rounded-xl border bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 [details[open]_&]:rotate-90" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold leading-tight">
            {titulo}
            {vencidos != null && vencidos > 0 && (
              <span
                title={`${vencidos} documento${vencidos > 1 ? "s" : ""} vencido${vencidos > 1 ? "s" : ""}`}
                aria-label={`${vencidos} vencido${vencidos > 1 ? "s" : ""}`}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[11px] font-semibold leading-none text-white tabular-nums"
              >
                {vencidos}
              </span>
            )}
          </p>
        </div>
        {slug && enviados > 0 && <BaixarGrupo slug={slug} empresa={empresa} />}
        <Badge
          variant="secondary"
          className={`shrink-0 font-medium tabular-nums ${completo ? "bg-primary/12 text-primary" : ""}`}
        >
          {total != null ? `${enviados}/${total}` : enviados}
        </Badge>
        {arquivos != null && arquivos > enviados && (
          <Badge variant="outline" className="shrink-0 font-normal tabular-nums text-muted-foreground">{arquivos} arquivos</Badge>
        )}
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

function LinhaDocumento({ doc, url, empresa }: { doc: Documento; url: string | null; empresa?: EmpresaSlug }) {
  const semValidade = tipoSemValidade(doc.tipo);
  const validade = avaliarValidade(doc.data_validade);
  const style = STATUS_STYLE[validade.status];
  const Icon = semValidade ? FileCheck2 : style.icon;

  return (
    <div data-doc-id={doc.id} className="flex items-center gap-4 rounded-lg border bg-background px-3 py-2.5 transition-shadow">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{doc.nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {doc.tipo !== TIPO_AVULSO ? `${nomeTipo(doc.tipo)} · ` : ""}
          {doc.arquivo_nome}
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
        empresa={empresa}
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

function LinhaPendente({ tipo, nome, empresa }: { tipo: string; nome: string; empresa?: EmpresaSlug }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-dashed px-3 py-2.5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <FileText className="size-5 text-muted-foreground/60" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-muted-foreground">{nome}</p>
      </div>
      <Badge variant="outline" className="shrink-0 gap-1 font-normal text-muted-foreground">
        <CircleHelp className="size-3.5" />
        Pendente
      </Badge>
      <UploadDocumento empresa={empresa} tipoFixo={tipo} nomeSugerido={nome} variant="outline" size="sm" label="Enviar" />
    </div>
  );
}
