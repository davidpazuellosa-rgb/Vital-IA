"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ETAPAS_LICITACAO, type EtapaSlug } from "@/lib/licitacoes/types";
import { atualizarEtapaLicitacao } from "@/lib/licitacoes/actions";

export function EtapaSelect({ id, etapa }: { id: string; etapa: EtapaSlug }) {
  const [pendente, startTransition] = useTransition();

  function onChange(valor: string) {
    startTransition(async () => {
      await atualizarEtapaLicitacao(id, valor as EtapaSlug);
    });
  }

  return (
    <Select value={etapa} onValueChange={onChange} disabled={pendente}>
      <SelectTrigger size="sm" className="h-8 w-[11rem] text-xs">
        {pendente ? <Loader2 className="size-3.5 animate-spin" /> : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {ETAPAS_LICITACAO.map((e) => (
          <SelectItem key={e.slug} value={e.slug} className="text-xs">
            {e.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
