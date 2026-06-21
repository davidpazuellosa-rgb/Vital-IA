"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, MoreVertical, Eye, CalendarCog, Trash2, Loader2, Plus, Pencil } from "lucide-react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHECKLIST_DOCUMENTOS, TIPO_AVULSO } from "@/lib/documentos/types";
import { registrarDocumento, removerDocumento, atualizarValidade, renomearDocumento, obterEmpresaUserId } from "@/lib/documentos/actions";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "documentos";

function sanitizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .slice(-120);
}

/* ---------------- Upload ---------------- */

export function UploadDocumento({
  tipoFixo,
  nomeSugerido,
  variant = "default",
  size = "default",
  label = "Adicionar documento",
  iconOnly = false,
}: {
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
        const path = `${empresaUserId}/${id}/${sanitizarNome(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

        // Registra metadados + extrai a data de validade no servidor
        await registrarDocumento({
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
                  {CHECKLIST_DOCUMENTOS.map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>
                      {t.nome}
                    </SelectItem>
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
            <Input id="arquivo" name="arquivo" type="file" accept=".pdf,image/*,application/pdf" required />
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
  id,
  nome,
  urlVisualizacao,
  dataValidade,
  semValidade,
}: {
  id: string;
  nome: string;
  urlVisualizacao: string | null;
  dataValidade: string | null;
  semValidade?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(dataValidade ?? "");
  const [renomeando, setRenomeando] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);
  const [pendente, startTransition] = useTransition();

  function salvarData() {
    const t = toast.loading("Salvando validade…");
    startTransition(async () => {
      try {
        await atualizarValidade(id, valor || null);
        setEditando(false);
        toast.success("Validade atualizada", { id: t });
      } catch (e) {
        toast.error("Não foi possível salvar", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  function salvarNome() {
    const t = toast.loading("Renomeando…");
    startTransition(async () => {
      try {
        await renomearDocumento(id, novoNome);
        setRenomeando(false);
        toast.success("Documento renomeado", { id: t });
      } catch (e) {
        toast.error("Não foi possível renomear", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  function remover() {
    if (!confirm("Remover este documento? O arquivo será apagado.")) return;
    const t = toast.loading("Removendo documento…");
    startTransition(async () => {
      try {
        await removerDocumento(id);
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
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setNovoNome(nome); setRenomeando(true); }}>
            <Pencil className="size-4" />
            Renomear
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
            <DialogTitle>Renomear documento</DialogTitle>
            <DialogDescription>
              Use para identificar melhor o documento (ex.: &ldquo;Balanço Patrimonial 2025&rdquo;).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`nome-${id}`}>Nome</Label>
            <Input
              id={`nome-${id}`}
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") salvarNome(); }}
            />
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
    </>
  );
}
