"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BookmarkPlus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarLicitacao } from "@/lib/licitacoes/actions";
import { EscolherEmpresa } from "@/components/acesso-contexto";
import type { EmpresaSlug } from "@/lib/empresas";
import type { UnifiedLicitacao } from "@/lib/licitacoes/types";

export function SalvarLicitacaoButton({ licitacao }: { licitacao: UnifiedLicitacao }) {
  const [salva, setSalva] = useState(false);
  const [pendente, startTransition] = useTransition();

  function salvar(empresa: EmpresaSlug) {
    const id = toast.loading("Salvando licitação…");
    startTransition(async () => {
      try {
        await salvarLicitacao(licitacao, empresa);
        setSalva(true);
        toast.success("Licitação salva", { id, description: "Disponível em Minhas Licitações." });
      } catch (e) {
        toast.error("Não foi possível salvar", { id, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <EscolherEmpresa onEscolher={salvar}>
      <Button disabled={pendente || salva} variant={salva ? "secondary" : "default"}>
        {pendente ? <Loader2 className="animate-spin" /> : salva ? <Check /> : <BookmarkPlus />}
        {salva ? "Salva" : "Salvar licitação"}
      </Button>
    </EscolherEmpresa>
  );
}
