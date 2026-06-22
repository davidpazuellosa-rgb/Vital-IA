"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, Plus, Pencil, Trash2, Loader2, Play, Pause, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { salvarAlerta, alternarAlerta, removerAlerta, salvarChatTelegram, enviarTesteTelegram, type Alerta } from "@/lib/alertas/actions";

export function CanaisNotificacao({
  chatId,
  botTokenConfigurado,
}: {
  chatId: string;
  botTokenConfigurado: boolean;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Dialog>
        <DialogTrigger asChild>
          <Card className="cursor-pointer shadow-sm transition-colors hover:bg-muted/40">
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Send className="size-5" />
                </div>
                <Badge variant={chatId && botTokenConfigurado ? "secondary" : "outline"}>
                  {chatId && botTokenConfigurado ? "Ativo" : "Pendente"}
                </Badge>
              </div>
              <div>
                <p className="font-semibold">Telegram</p>
                <p className="text-sm text-muted-foreground">Token do bot, chat id e envio de teste.</p>
              </div>
            </CardContent>
          </Card>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Telegram</DialogTitle>
            <DialogDescription>
              Informe o token do bot e seu chat id. O token fica salvo no banco e não é exibido novamente.
            </DialogDescription>
          </DialogHeader>
          <TelegramConfig chatId={chatId} botTokenConfigurado={botTokenConfigurado} />
        </DialogContent>
      </Dialog>

      <CanalEmBreve
        titulo="WhatsApp"
        descricao="Número, provedor/API e token para alertas por WhatsApp."
        icon={MessageCircle}
        campos={["Número do WhatsApp", "Token/API do provedor", "Identificador do remetente"]}
      />

      <CanalEmBreve
        titulo="E-mail"
        descricao="Endereço, remetente e credenciais para alertas por e-mail."
        icon={Mail}
        campos={["E-mail de destino", "Remetente", "Token/API de envio"]}
      />
    </div>
  );
}

function CanalEmBreve({
  titulo,
  descricao,
  icon: Icon,
  campos,
}: {
  titulo: string;
  descricao: string;
  icon: typeof Mail;
  campos: string[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer shadow-sm transition-colors hover:bg-muted/40">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-5" />
              </div>
              <Badge variant="outline">Em breve</Badge>
            </div>
            <div>
              <p className="font-semibold">{titulo}</p>
              <p className="text-sm text-muted-foreground">{descricao}</p>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar {titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {campos.map((campo) => (
            <div key={campo} className="flex flex-col gap-1.5">
              <Label>{campo}</Label>
              <Input disabled placeholder="Será habilitado na próxima etapa" />
            </div>
          ))}
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Estrutura visual pronta. O envio por {titulo} ainda não está conectado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TelegramConfig({ chatId, botTokenConfigurado }: { chatId: string; botTokenConfigurado: boolean }) {
  const [valor, setValor] = useState(chatId);
  const [salvo, setSalvo] = useState(chatId);
  const [token, setToken] = useState("");
  const [tokenSalvo, setTokenSalvo] = useState(botTokenConfigurado);
  const [pendente, startTransition] = useTransition();
  const [testando, startTeste] = useTransition();
  const mudou = valor !== salvo || Boolean(token.trim());

  function salvar() {
    const t = toast.loading("Salvando…");
    startTransition(async () => {
      try {
        const resultado = await salvarChatTelegram(valor, token);
        if (resultado.ok) {
          setSalvo(valor.trim());
          setValor(valor.trim());
          if (resultado.tokenSalvo !== false && token.trim()) {
            setToken("");
            setTokenSalvo(true);
          }
          if (resultado.tokenSalvo === false) setTokenSalvo(false);
          toast.success("Telegram configurado", { id: t, description: resultado.aviso });
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
        const resultado = await enviarTesteTelegram(token);
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
          <Label htmlFor="telegram_bot_token">Token do bot</Label>
          <Input
            id="telegram_bot_token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={tokenSalvo ? "Token já salvo — cole outro para trocar" : "Cole o token do bot"}
            autoComplete="off"
          />
        </div>
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
        <Button onClick={salvar} disabled={pendente || !mudou} className="shrink-0">
          {pendente && <Loader2 className="animate-spin" />} Salvar
        </Button>
        <Button
          variant="outline"
          onClick={testar}
          disabled={testando || !salvo || valor !== salvo || (!tokenSalvo && !token.trim())}
          className="shrink-0"
          title={!salvo || (!tokenSalvo && !token.trim()) ? "Salve ou informe o token e o chat id primeiro" : "Enviar mensagem de teste"}
        >
          {testando ? <Loader2 className="animate-spin" /> : <Send />} Enviar teste
        </Button>
      </div>
      {(!salvo || (!tokenSalvo && !token.trim())) && <p className="text-xs text-muted-foreground">Salve ou informe o token do bot e o chat id para liberar o teste.</p>}
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
