"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CriarPropostaDialog } from "@/components/criar-proposta-dialog";
import { EnvioPropostaDialog } from "@/components/envio-proposta-dialog";
import { removerLicitacaoSalva } from "@/lib/licitacoes/actions";

type Abridor = { abrir: () => void };

/** Menu de três pontinhos com Proposta, Enviar e Remover; os diálogos ficam montados fora do menu. */
export function AcoesLicitacaoMenu({
  id,
  temProposta = false,
  enviada = false,
  comProposta = true,
}: {
  id: string;
  temProposta?: boolean;
  enviada?: boolean;
  /** Na tabela não há "Proposta" (ela abre pelo perfil da licitação, no título). */
  comProposta?: boolean;
}) {
  const proposta = useRef<Abridor>(null);
  const envio = useRef<Abridor>(null);
  const [removendo, startTransition] = useTransition();

  function remover() {
    const t = toast.loading("Removendo licitação…");
    startTransition(async () => {
      try {
        await removerLicitacaoSalva(id);
        toast.success("Licitação removida", { id: t });
      } catch (e) {
        toast.error("Não foi possível remover", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <>
      {comProposta && <CriarPropostaDialog ref={proposta} oculto licitacaoId={id} temPropostaInicial={temProposta} size="sm" />}
      <EnvioPropostaDialog ref={envio} oculto licitacaoId={id} enviada={enviada} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" disabled={removendo} title="Mais ações" aria-label="Mais ações">
            {removendo ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {comProposta && (
            <DropdownMenuItem onSelect={() => proposta.current?.abrir()} className="gap-2 text-xs">
              <FileText className="size-4" /> {temProposta ? "Abrir rascunho" : "Proposta"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => envio.current?.abrir()} className="gap-2 text-xs">
            {enviada ? <CheckCircle2 className="size-4 text-primary" /> : <Send className="size-4" />} {enviada ? "Ver envio" : "Enviar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={remover} className="gap-2 text-xs text-destructive focus:text-destructive">
            <Trash2 className="size-4" /> Remover
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
