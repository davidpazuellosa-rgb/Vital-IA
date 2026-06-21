"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";
import { salvarAlerta, alternarAlerta, removerAlerta, salvarChatTelegram, enviarTesteTelegram, type Alerta } from "@/lib/alertas/actions";

export function TelegramConfig({ chatId }: { chatId: string }) {
  const [valor, setValor] = useState(chatId);
  const [salvo, setSalvo] = useState(chatId);
  const [pendente, startTransition] = useTransition();
  const [testando, startTeste] = useTransition();

  function salvar() {
    const t = toast.loading("Salvando…");
    startTransition(async () => {
      try {
        const resultado = await salvarChatTelegram(valor);
        if (resultado.ok) {
          setSalvo(valor.trim());
          setValor(valor.trim());
          toast.success("Telegram configurado", { id: t });
        } else {
          toast.error("Não foi possível salvar", { id: t, description: resultado.erro });
        }
      } catch (e) {
        toast.error("Não foi possível salvar", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  function testar() {
    const t = toast.loading("Enviando mensagem de teste…");
    startTeste(async () => {
      try {
        const resultado = await enviarTesteTelegram();
        if (resultado.ok) {
          toast.success("Teste enviado", { id: t, description: "Confira o Telegram." });
        } else {
          toast.error("Falha no envio", { id: t, description: resultado.erro });
        }
      } catch (e) {
        toast.error("Falha no envio", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="telegram_chat_id">Telegram chat id</Label>
          <Input
            id="telegram_chat_id"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="numeric"
            placeholder="Ex.: 123456789"
          />
        </div>
        <Button onClick={salvar} disabled={pendente || valor === salvo} className="shrink-0">
          {pendente && <Loader2 className="animate-spin" />} Salvar
        </Button>
        <Button
          variant="outline"
          onClick={testar}
          disabled={testando || !salvo || valor !== salvo}
          className="shrink-0"
          title={!salvo ? "Salve o chat id primeiro" : "Enviar mensagem de teste"}
        >
          {testando ? <Loader2 className="animate-spin" /> : <Send />} Enviar teste
        </Button>
      </div>
      {!salvo && <p className="text-xs text-muted-foreground">Salve o chat id para liberar o teste.</p>}
    </div>
  );
}

export function AlertaDialog({ alerta }: { alerta?: Alerta }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const edicao = Boolean(alerta);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const t = toast.loading(edicao ? "Salvando alerta…" : "Criando alerta…");
    startTransition(async () => {
      try {
        await salvarAlerta(fd);
        setAberto(false);
        toast.success(edicao ? "Alerta salvo" : "Alerta criado", { id: t });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao salvar.";
        setErro(msg);
        toast.error("Não foi possível salvar", { id: t, description: msg });
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {edicao ? (
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground"><Pencil className="size-4" /></Button>
        ) : (
          <Button><Plus /> Novo alerta</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{edicao ? "Editar alerta" : "Novo alerta"}</DialogTitle>
          <DialogDescription>
            Busca automática que roda de hora em hora e te avisa de novas licitações que batem com estes filtros.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {alerta && <input type="hidden" name="id" value={alerta.id} />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nome">Nome do alerta</Label>
            <Input id="nome" name="nome" defaultValue={alerta?.nome} placeholder="Ex.: Serviços médicos em MG" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="keyword">Palavra-chave</Label>
            <Input id="keyword" name="keyword" defaultValue={alerta?.keyword} placeholder="Ex.: alimentação, médico, limpeza" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ufs">UFs (separadas por vírgula)</Label>
            <Input id="ufs" name="ufs" defaultValue={alerta?.ufs?.join(", ")} placeholder="Ex.: AM, MG, SP" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="valor_min">Valor mínimo (R$)</Label>
              <Input id="valor_min" name="valor_min" type="number" defaultValue={alerta?.valor_min ?? ""} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="valor_max">Valor máximo (R$)</Label>
              <Input id="valor_max" name="valor_max" type="number" defaultValue={alerta?.valor_max ?? ""} placeholder="sem limite" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="apenas_aberto" defaultChecked={alerta?.apenas_aberto ?? true} value="on" />
            Somente licitações em aberto para proposta
          </label>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              {pendente && <Loader2 className="animate-spin" />} {edicao ? "Salvar" : "Criar alerta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AlertaToggle({ id, ativo }: { id: string; ativo: boolean }) {
  const [pendente, startTransition] = useTransition();
  function alternar() {
    const t = toast.loading(ativo ? "Pausando…" : "Ativando…");
    startTransition(async () => {
      try {
        await alternarAlerta(id, !ativo);
        toast.success(ativo ? "Alerta pausado" : "Alerta ativado", { id: t });
      } catch (e) {
        toast.error("Não foi possível alterar", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }
  return (
    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={alternar} disabled={pendente} title={ativo ? "Pausar" : "Ativar"}>
      {pendente ? <Loader2 className="size-4 animate-spin" /> : ativo ? <Pause className="size-4" /> : <Play className="size-4" />}
    </Button>
  );
}

export function AlertaRemover({ id }: { id: string }) {
  const [pendente, startTransition] = useTransition();
  function remover() {
    if (!confirm("Remover este alerta?")) return;
    const t = toast.loading("Removendo alerta…");
    startTransition(async () => {
      try {
        await removerAlerta(id);
        toast.success("Alerta removido", { id: t });
      } catch (e) {
        toast.error("Não foi possível remover", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }
  return (
    <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={remover} disabled={pendente} title="Remover">
      {pendente ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}
