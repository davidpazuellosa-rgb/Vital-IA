"use client";

import { useState, useTransition } from "react";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarLicitacao } from "@/lib/licitacoes/actions";
import type { UnifiedLicitacao } from "@/lib/licitacoes/types";

export function SalvarLicitacaoButton({ licitacao }: { licitacao: UnifiedLicitacao }) {
  const [salva, setSalva] = useState(false);
  const [pendente, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      try {
        await salvarLicitacao(licitacao);
        setSalva(true);
      } catch {
        // mantém o botão habilitado para nova tentativa
      }
    });
  }

  return (
    <Button onClick={salvar} disabled={pendente || salva} variant={salva ? "secondary" : "default"}>
      {pendente ? <Loader2 className="animate-spin" /> : salva ? <Check /> : <BookmarkPlus />}
      {salva ? "Salva" : "Salvar licitação"}
    </Button>
  );
}
