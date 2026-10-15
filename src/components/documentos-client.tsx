"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, MoreVertical, Eye, CalendarCog, Trash2, Loader2, Plus, Pencil, Download, FileDown, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRUPOS_DOCUMENTOS, TIPO_AVULSO, siteResponsavel } from "@/lib/documentos/types";
import { configEmpresa, type EmpresaSlug } from "@/lib/empresas";
import { registrarDocumento, substituirDocumento, removerDocumento, atualizarValidade, editarDocumento, obterEmpresaUserId } from "@/lib/documentos/actions";
import { ZonaArquivo } from "@/components/zona-arquivo";
import { createClient } from "@/lib/supabase/client";
import { comDownload } from "@/lib/format";

const BUCKET = "documentos";

function sanitizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .slice(-120);
}

/* ---------------- Upload ---------------- */

/** Baixa todos os documentos de um grupo do checklist num ZIP. */
export function BaixarGrupo({ slug, empresa }: { slug: string; empresa?: EmpresaSlug }) {
  return (
    <a
      href={`/api/documentos/exportar?grupo=${encodeURIComponent(slug)}${empresa ? `&empresa=${empresa}` : ""}`}
      onClick={(e) => e.stopPropagation()}
      title="Baixar todos os documentos deste grupo (ZIP)"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
    >
      <Download className="size-3.5" /> Baixar todos
    </a>
  );
}

export function UploadDocumento({
  empresa,
  tipoFixo,
  nomeSugerido,
  variant = "default",
  size = "default",
  label = "Adicionar documento",
  iconOnly = false,
}: {
  empresa?: EmpresaSlug;
  tipoFixo?: string;
  nomeSugerido?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
  label?: string;
  iconOnly?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("arquivo");
    const tipo = (fd.get("tipo") as string) || tipoFixo || TIPO_AVULSO;
    const nome = (fd.get("nome") as string)?.trim();

    if (!(file instanceof File) || file.size === 0) {
      setErro("Selecione um arquivo.");
      return;
    }

    const tToast = toast.loading("Enviando documento…");
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sessão expirada. Faça login novamente.");

        // Upload direto do navegador para o Storage (sem passar pelo Server Action)
        const empresaUserId = await obterEmpresaUserId();
        const id = crypto.randomUUID();
        const path = `${empresaUserId}/${configEmpresa(empresa).pastaStorage}${id}/${sanitizarNome(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

        // Registra metadados + extrai a data de validade no servidor
        await registrarDocumento({
          empresa,
          id,
          tipo,
          nome: nome || file.name,
          path,
          arquivoNome: file.name,
          mimeType: file.type,
        });

        form.reset();
        setAberto(false);
        toast.success("Documento enviado", { id: tToast });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao enviar o documento.";
        setErro(msg);
        toast.error("Falha ao enviar", { id: tToast, description: msg });
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {iconOnly ? <Plus /> : <Upload />}
          {!iconOnly && label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>
            Aceita PDF, imagem ou outros arquivos. Em PDFs com texto, a data de validade é
            detectada automaticamente — você pode corrigir depois.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {tipoFixo ? (
            <input type="hidden" name="tipo" value={tipoFixo} />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tipo">Tipo</Label>
              <Select name="tipo" defaultValue={TIPO_AVULSO}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TIPO_AVULSO}>Avulso / outro</SelectItem>
                  {GRUPOS_DOCUMENTOS.map((g) => (
                    <SelectGroup key={g.slug}>
                      <SelectLabel>{g.titulo}</SelectLabel>
                      {[...g.tipos, g.extra].map((t) => <SelectItem key={t.slug} value={t.slug}>{t.nome}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">Nome do documento</Label>
            <Input id="nome" name="nome" defaultValue={nomeSugerido} placeholder="Ex.: CND Federal" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="arquivo">Arquivo</Label>
            <ZonaArquivo id="arquivo" />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              {pendente ? <Loader2 className="animate-spin" /> : <Upload />}
              {pendente ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Ações de um documento ---------------- */

export function DocumentoAcoes({
  empresa,
  id,
  tipo,
  nome,
  arquivoNome,
  urlVisualizacao,
  dataValidade,
  semValidade,
}: {
  empresa?: EmpresaSlug;
  id: string;
  tipo: string;
  nome: string;
  arquivoNome: string;
  urlVisualizacao: string | null;
  dataValidade: string | null;
  semValidade?: boolean;
}) {
  const urlSite = siteResponsavel(tipo);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(dataValidade ?? "");
  const [renomeando, setRenomeando] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);
  const [novoTipo, setNovoTipo] = useState(tipo);
  const [substituindo, setSubstituindo] = useState(false);
  const [erroSubstituir, setErroSubstituir] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const [enviandoSubstituto, startSubstituirTransition] = useTransition();

  function onSubmitSubstituir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErroSubstituir(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("arquivo");
    if (!(file instanceof File) || file.size === 0) {
      setErroSubstituir("Selecione um arquivo.");
      return;
    }
    const t = toast.loading("Enviando novo arquivo…");
    startSubstituirTransition(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sessão expirada. Faça login novamente.");
        const empresaUserId = await obterEmpresaUserId();
        const path = `${empresaUserId}/${configEmpresa(empresa).pastaStorage}${id}/${sanitizarNome(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true });
        if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

        await substituirDocumento({ empresa, id, path, arquivoNome: file.name, mimeType: file.type });

        form.reset();
        setSubstituindo(false);
        toast.success("Documento substituído", { id: t, description: "A validade foi verificada automaticamente." });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao substituir o documento.";
        setErroSubstituir(msg);
        toast.error("Falha ao substituir", { id: t, description: msg });
      }
    });
  }

  function salvarData() {
    const t = toast.loading("Salvando validade…");
    startTransition(async () => {
      try {
        await atualizarValidade(id, valor || null, empresa);
        setEditando(false);
        toast.success("Validade atualizada", { id: t });
      } catch (e) {
        toast.error("Não foi possível salvar", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  function salvarNome() {
    const t = toast.loading("Salvando…");
    startTransition(async () => {
      try {
        await editarDocumento(id, { nome: novoNome, tipo: novoTipo }, empresa);
        setRenomeando(false);
        toast.success("Documento atualizado", { id: t });
      } catch (e) {
        toast.error("Não foi possível salvar", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  function remover() {
    if (!confirm("Remover este documento? O arquivo será apagado.")) return;
    const t = toast.loading("Removendo documento…");
    startTransition(async () => {
      try {
        await removerDocumento(id, empresa);
        toast.success("Documento removido", { id: t });
      } catch (e) {
        toast.error("Não foi possível remover", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {urlVisualizacao && (
            <DropdownMenuItem asChild>
              <a href={urlVisualizacao} target="_blank" rel="noreferrer">
                <Eye className="size-4" />
                Visualizar
              </a>
            </DropdownMenuItem>
          )}
          {urlVisualizacao && (
            <DropdownMenuItem asChild>
              <a href={comDownload(urlVisualizacao, arquivoNome || nome)}>
                <FileDown className="size-4" />
                Baixar
              </a>
            </DropdownMenuItem>
          )}
          {urlSite && (
            <DropdownMenuItem asChild>
              <a href={urlSite} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Site responsável
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setErroSubstituir(null); setSubstituindo(true); }}>
            <RefreshCw className="size-4" />
            Substituir arquivo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setNovoNome(nome); setNovoTipo(tipo); setRenomeando(true); }}>
            <Pencil className="size-4" />
            Editar nome e categoria
          </DropdownMenuItem>
          {!semValidade && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditando(true); }}>
              <CalendarCog className="size-4" />
              Editar validade
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); remover(); }}>
            <Trash2 className="size-4" />
            Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar data de validade</DialogTitle>
            <DialogDescription>
              Ajuste a data caso a detecção automática não tenha acertado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`val-${id}`}>Validade</Label>
            <Input
              id={`val-${id}`}
              type="date"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(false)} disabled={pendente}>
              Cancelar
            </Button>
            <Button onClick={salvarData} disabled={pendente}>
              {pendente && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renomeando} onOpenChange={setRenomeando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
            <DialogDescription>
              Ajuste o nome e a categoria (ex.: &ldquo;Balanço Patrimonial 2025&rdquo;).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`nome-${id}`}>Nome</Label>
              <Input
                id={`nome-${id}`}
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") salvarNome(); }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <Select value={novoTipo} onValueChange={setNovoTipo}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRUPOS_DOCUMENTOS.map((g) => (
                    <SelectGroup key={g.slug}>
                      <SelectLabel>{g.titulo}</SelectLabel>
                      {[...g.tipos, g.extra].map((t) => <SelectItem key={t.slug} value={t.slug}>{t.nome}</SelectItem>)}
                    </SelectGroup>
                  ))}
                  <SelectGroup>
                    <SelectLabel>Outros</SelectLabel>
                    <SelectItem value={TIPO_AVULSO}>Avulso</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenomeando(false)} disabled={pendente}>
              Cancelar
            </Button>
            <Button onClick={salvarNome} disabled={pendente || !novoNome.trim()}>
              {pendente && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={substituindo} onOpenChange={(v) => { setSubstituindo(v); if (!v) setErroSubstituir(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substituir arquivo</DialogTitle>
            <DialogDescription>
              Envie a 2ª via deste documento. Em PDFs com texto, a validade é detectada
              automaticamente — você pode corrigir depois em &ldquo;Editar validade&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmitSubstituir} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`arquivo-sub-${id}`}>Novo arquivo</Label>
              <ZonaArquivo id={`arquivo-sub-${id}`} />
            </div>
            {erroSubstituir && <p className="text-sm text-destructive">{erroSubstituir}</p>}
            <DialogFooter>
              <Button type="submit" disabled={enviandoSubstituto}>
                {enviandoSubstituto ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {enviandoSubstituto ? "Enviando..." : "Substituir"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
