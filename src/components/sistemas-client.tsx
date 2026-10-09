"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Pencil, Trash2, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { criarSistema, atualizarSistema, removerSistema } from "@/lib/sistemas/actions";
import type { SistemaLicitacao } from "@/lib/sistemas/types";

/**
 * Abre o sistema numa aba própria (uma por sistema). Se a aba já estiver aberta,
 * só volta para ela — mantém o login e a tela em que você estava.
 *
 * Não dá para "embutir" esses portais dentro do Vital.IA: a maioria proíbe ser
 * exibida em iframe (X-Frame-Options) e, nos que permitem, o navegador bloqueia
 * os cookies de sessão dentro do quadro — o login não se manteria.
 */
export function AbrirSistema({ id, url, rotulo = "Abrir", className = "flex-1" }: { id: string; url: string; rotulo?: string; className?: string }) {
  function abrir() {
    const janela = window.open("", `vitalia-sistema-${id}`);
    if (!janela) {
      // Bloqueador de pop-up: abre numa aba comum.
      window.open(url, "_blank", "noopener");
      return;
    }
    let novaAba = false;
    try {
      novaAba = janela.location.href === "about:blank";
    } catch {
      novaAba = false; // aba já está no sistema (outra origem): só focar
    }
    if (novaAba) {
      janela.opener = null; // o portal não ganha acesso a esta aba
      janela.location.href = url;
    }
    janela.focus();
  }

  return (
    <Button onClick={abrir} className={className}>
      <ExternalLink /> {rotulo}
    </Button>
  );
}

export function CopiarLogin({ login }: { login: string }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(login);
      toast.success("Login copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }
  return (
    <button
      type="button"
      onClick={copiar}
      title="Copiar login"
      className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="truncate">{login}</span>
      <Copy className="size-3 shrink-0" />
    </button>
  );
}

export function FormSistema({ sistema }: { sistema?: SistemaLicitacao }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const editando = Boolean(sistema);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        if (sistema) await atualizarSistema(sistema.id, fd);
        else await criarSistema(fd);
        setAberto(false);
        toast.success(editando ? "Sistema atualizado" : "Sistema adicionado");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao salvar.";
        setErro(msg);
        toast.error("Não foi possível salvar", { description: msg });
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) setErro(null); }}>
      <DialogTrigger asChild>
        {editando ? (
          <Button variant="ghost" size="icon" title="Editar" aria-label="Editar sistema">
            <Pencil />
          </Button>
        ) : (
          <Button><Plus /> Adicionar sistema</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? "Editar sistema" : "Novo sistema de licitação"}</DialogTitle>
          <DialogDescription>
            A senha não fica no Vital.IA: salve-a no navegador ao entrar no sistema pela primeira vez.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sis-nome">Nome</Label>
            <Input id="sis-nome" name="nome" defaultValue={sistema?.nome} placeholder="Ex.: BLL Compras" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sis-url">Endereço de acesso</Label>
            <Input id="sis-url" name="url" defaultValue={sistema?.url} placeholder="Ex.: bllcompras.com" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sis-login">Login (opcional)</Label>
            <Input id="sis-login" name="login" defaultValue={sistema?.login} placeholder="Usuário, CPF ou CNPJ de acesso" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sis-obs">Observações (opcional)</Label>
            <Input id="sis-obs" name="observacoes" defaultValue={sistema?.observacoes} placeholder="Ex.: login com certificado digital" />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              {pendente && <Loader2 className="animate-spin" />} {editando ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoverSistema({ id, nome }: { id: string; nome: string }) {
  const [pendente, startTransition] = useTransition();
  function remover() {
    if (!window.confirm(`Remover "${nome}" da lista de sistemas?`)) return;
    startTransition(async () => {
      try {
        await removerSistema(id);
        toast.success("Sistema removido");
      } catch (err) {
        toast.error("Não foi possível remover", { description: err instanceof Error ? err.message : undefined });
      }
    });
  }
  return (
    <Button variant="ghost" size="icon" onClick={remover} disabled={pendente} title="Remover" aria-label="Remover sistema">
      {pendente ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
