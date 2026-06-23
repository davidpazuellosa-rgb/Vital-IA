"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Upload, Loader2, MoreVertical, Eye, Trash2, Check, ArrowRight } from "lucide-react";
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
  criarCliente, registrarClienteDocumento, removerClienteDocumento, removerCliente, atualizarClienteStatus,
  criarContratacao, removerContratacao, atualizarContratacaoStatus,
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
        toast.success("Cliente criado");
        router.push(`/vital-norte/clientes/${id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao criar cliente.";
        setErro(msg);
        toast.error("Não foi possível criar o cliente", { description: msg });
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

/* ---------- Upload de documento da contratação ---------- */
export function ClienteDocUpload({
  clienteId, contratacaoId, tipo, label = "Enviar", variant = "outline",
}: {
  clienteId: string;
  contratacaoId: string;
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

    const tToast = toast.loading("Enviando documento…");
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
        await registrarClienteDocumento({ clienteId, contratacaoId, tipo, nome: nome || file.name, path, arquivoNome: file.name });
        form.reset();
        setAberto(false);
        toast.success("Documento enviado", { id: tToast });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao enviar.";
        setErro(msg);
        toast.error("Falha ao enviar", { id: tToast, description: msg });
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
export function ClienteDocAcoes({ id, clienteId, contratacaoId, url }: { id: string; clienteId: string; contratacaoId: string; url: string | null }) {
  const [pendente, startTransition] = useTransition();
  function remover() {
    if (!confirm("Remover este documento? O arquivo será apagado.")) return;
    const t = toast.loading("Removendo documento…");
    startTransition(async () => {
      try {
        await removerClienteDocumento(id, clienteId, contratacaoId);
        toast.success("Documento removido", { id: t });
      } catch (e) {
        toast.error("Não foi possível remover", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
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

/* ---------- Adicionar contratação/licitação ---------- */
export function AdicionarContratacao({ clienteId }: { clienteId: string }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    fd.set("clienteId", clienteId);
    startTransition(async () => {
      try {
        const id = await criarContratacao(fd);
        setAberto(false);
        toast.success("Licitação criada");
        router.push(`/vital-norte/clientes/${clienteId}/contratacao/${id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao criar.";
        setErro(msg);
        toast.error("Não foi possível criar", { description: msg });
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Nova licitação</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova licitação / contratação</DialogTitle>
          <DialogDescription>Cada licitação reúne seus próprios documentos (proposta, empenho, contrato, NFs).</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" name="titulo" placeholder="Ex.: PROAD 19056.2026" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="identificador">Identificador (opcional)</Label>
            <Input id="identificador" name="identificador" placeholder="Ex.: NE 2026NE000567" />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pendente}>{pendente && <Loader2 className="animate-spin" />} Criar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Status da contratação ---------- */
export function ContratacaoStatus({
  id, clienteId, status, proximoPasso,
}: {
  id: string; clienteId: string; status: string; proximoPasso: string;
}) {
  const [s, setS] = useState(status);
  const [p, setP] = useState(proximoPasso);
  const [pendente, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const alterado = s !== status || p !== proximoPasso;

  function salvar() {
    setSalvo(false);
    startTransition(async () => {
      try {
        await atualizarContratacaoStatus(id, clienteId, s, p);
        setSalvo(true);
        setTimeout(() => setSalvo(false), 2500);
        toast.success("Status atualizado");
      } catch (e) {
        toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cstatus" className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
        <Input id="cstatus" value={s} onChange={(e) => setS(e.target.value)} placeholder="Ex.: Contratada — empenho emitido" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cproximo" className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <ArrowRight className="size-3" /> Próximo passo
        </Label>
        <Input id="cproximo" value={p} onChange={(e) => setP(e.target.value)} placeholder="Ex.: Emitir nota fiscal" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button size="sm" onClick={salvar} disabled={pendente || !alterado}>
          {pendente && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
        {salvo && <span className="flex items-center gap-1 text-sm text-primary"><Check className="size-4" /> Salvo</span>}
      </div>
    </div>
  );
}

/* ---------- Remover contratação ---------- */
export function RemoverContratacaoButton({ id, clienteId }: { id: string; clienteId: string }) {
  const [pendente, startTransition] = useTransition();
  const router = useRouter();
  function remover() {
    if (!confirm("Remover esta licitação e todos os seus documentos?")) return;
    const t = toast.loading("Removendo licitação…");
    startTransition(async () => {
      try {
        await removerContratacao(id, clienteId);
        toast.success("Licitação removida", { id: t });
        router.push(`/vital-norte/clientes/${clienteId}`);
      } catch (e) {
        toast.error("Não foi possível remover", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }
  return (
    <Button variant="outline" size="sm" onClick={remover} disabled={pendente} className="text-destructive">
      {pendente ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Remover licitação
    </Button>
  );
}

/* ---------- Status e próximo passo (cliente) ---------- */
export function ClienteStatus({
  id, status, proximoPasso,
}: {
  id: string;
  status: string;
  proximoPasso: string;
}) {
  const [s, setS] = useState(status);
  const [p, setP] = useState(proximoPasso);
  const [pendente, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const alterado = s !== status || p !== proximoPasso;

  function salvar() {
    setSalvo(false);
    startTransition(async () => {
      try {
        await atualizarClienteStatus(id, s, p);
        setSalvo(true);
        setTimeout(() => setSalvo(false), 2500);
        toast.success("Status atualizado");
      } catch (e) {
        toast.error("Não foi possível salvar", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status" className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
        <Input id="status" value={s} onChange={(e) => setS(e.target.value)} placeholder="Ex.: Em contratação" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proximo" className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <ArrowRight className="size-3" /> Próximo passo
        </Label>
        <Input id="proximo" value={p} onChange={(e) => setP(e.target.value)} placeholder="Ex.: Aguardar nota de empenho" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button size="sm" onClick={salvar} disabled={pendente || !alterado}>
          {pendente && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
        {salvo && <span className="flex items-center gap-1 text-sm text-primary"><Check className="size-4" /> Salvo</span>}
      </div>
    </div>
  );
}

/* ---------- Remover cliente ---------- */
export function RemoverClienteButton({ id, compacto = false }: { id: string; compacto?: boolean }) {
  const [pendente, startTransition] = useTransition();
  const router = useRouter();
  function remover() {
    if (!confirm("Remover este cliente e todos os seus documentos?")) return;
    const t = toast.loading("Removendo cliente…");
    startTransition(async () => {
      try {
        await removerCliente(id);
        toast.success("Cliente removido", { id: t });
        router.push("/vital-norte/clientes");
      } catch (e) {
        toast.error("Não foi possível remover", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }
  if (compacto) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={remover}
        disabled={pendente}
        className="size-8 text-destructive hover:text-destructive"
        title="Remover cliente"
        aria-label="Remover cliente"
      >
        {pendente ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={remover} disabled={pendente} className="text-destructive">
      {pendente ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Remover cliente
    </Button>
  );
}
