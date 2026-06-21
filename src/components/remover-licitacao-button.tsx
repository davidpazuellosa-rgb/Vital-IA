"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removerLicitacaoSalva } from "@/lib/licitacoes/actions";

export function RemoverLicitacaoButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

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
    <Button size="sm" variant="ghost" disabled={pending} onClick={remover}>
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
