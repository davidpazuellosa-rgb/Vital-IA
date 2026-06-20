"use client";

import { useState, useTransition } from "react";
import { Upload, MoreVertical, Eye, CalendarCog, Trash2, Loader2, Plus } from "lucide-react";
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
import { uploadDocumento, removerDocumento, atualizarValidade } from "@/lib/documentos/actions";

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

  function onSubmit(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      try {
        await uploadDocumento(formData);
        setAberto(false);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao enviar o documento.");
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
        <form action={onSubmit} className="flex flex-col gap-4">
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
  urlVisualizacao,
  dataValidade,
}: {
  id: string;
  urlVisualizacao: string | null;
  dataValidade: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(dataValidade ?? "");
  const [pendente, startTransition] = useTransition();

  function salvarData() {
    startTransition(async () => {
      await atualizarValidade(id, valor || null);
      setEditando(false);
    });
  }

  function remover() {
    if (!confirm("Remover este documento? O arquivo será apagado.")) return;
    startTransition(async () => {
      await removerDocumento(id);
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
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditando(true); }}>
            <CalendarCog className="size-4" />
            Editar validade
          </DropdownMenuItem>
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
    </>
  );
}
