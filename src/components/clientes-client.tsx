"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Upload, Loader2, MoreVertical, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import {
  criarCliente, registrarClienteDocumento, removerClienteDocumento, removerCliente,
} from "@/lib/clientes/actions";

const BUCKET = "documentos";
const sanitizar = (n: string) =>
  n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);

/* ---------- Adicionar cliente ---------- */
export function AdicionarCliente() {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const id = await criarCliente(fd);
        setAberto(false);
        router.push(`/vital-norte/clientes/${id}`);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao criar cliente.");
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button><Plus /> Adicionar cliente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>Cada cliente reúne propostas, empenhos, notas fiscais e contratos.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" placeholder="Ex.: TRT 11" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orgao">Órgão (opcional)</Label>
            <Input id="orgao" name="orgao" placeholder="Ex.: Tribunal Regional do Trabalho da 11ª Região" />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              {pendente && <Loader2 className="animate-spin" />} Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Upload de documento do cliente ---------- */
export function ClienteDocUpload({
  clienteId, tipo, label = "Enviar", variant = "outline",
}: {
  clienteId: string;
  tipo: string;
  label?: string;
  variant?: "default" | "outline";
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("arquivo");
    const nome = (fd.get("nome") as string)?.trim();
    if (!(file instanceof File) || file.size === 0) { setErro("Selecione um arquivo."); return; }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sessão expirada. Faça login novamente.");
        const docId = crypto.randomUUID();
        const path = `${user.id}/clientes/${clienteId}/${docId}/${sanitizar(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);
        await registrarClienteDocumento({ clienteId, tipo, nome: nome || file.name, path, arquivoNome: file.name });
        form.reset();
        setAberto(false);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao enviar.");
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm"><Upload /> {label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>O arquivo fica vinculado a este cliente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">Nome do documento</Label>
            <Input id="nome" name="nome" placeholder="Ex.: NF 001/2026" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="arquivo">Arquivo</Label>
            <Input id="arquivo" name="arquivo" type="file" accept=".pdf,image/*,application/pdf" required />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              {pendente ? <Loader2 className="animate-spin" /> : <Upload />} {pendente ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Ações de um documento ---------- */
export function ClienteDocAcoes({ id, clienteId, url }: { id: string; clienteId: string; url: string | null }) {
  const [pendente, startTransition] = useTransition();
  function remover() {
    if (!confirm("Remover este documento? O arquivo será apagado.")) return;
    startTransition(async () => { await removerClienteDocumento(id, clienteId); });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {url && (
          <DropdownMenuItem asChild>
            <a href={url} target="_blank" rel="noreferrer"><Eye className="size-4" /> Visualizar</a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); remover(); }}>
          <Trash2 className="size-4" /> Remover
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------- Remover cliente ---------- */
export function RemoverClienteButton({ id }: { id: string }) {
  const [pendente, startTransition] = useTransition();
  const router = useRouter();
  function remover() {
    if (!confirm("Remover este cliente e todos os seus documentos?")) return;
    startTransition(async () => {
      await removerCliente(id);
      router.push("/vital-norte/clientes");
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={remover} disabled={pendente} className="text-destructive">
      {pendente ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Remover cliente
    </Button>
  );
}
