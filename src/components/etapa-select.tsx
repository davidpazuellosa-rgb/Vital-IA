"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ETAPAS_LICITACAO, nomeEtapa, type EtapaSlug } from "@/lib/licitacoes/types";
import { atualizarEtapaLicitacao, converterLicitacaoEmCliente } from "@/lib/licitacoes/actions";

export function EtapaSelect({
  id,
  etapa,
  size = "sm",
  className = "h-8 w-[11rem] text-xs",
}: {
  id: string;
  etapa: EtapaSlug;
  size?: "sm" | "default";
  className?: string;
}) {
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function onChange(valor: string) {
    startTransition(async () => {
      try {
        if (valor === "vencida") {
          // Vencida vira cliente: cria/abre o cliente e a contratação.
          const t = toast.loading("Marcando como vencida e abrindo o cliente…");
          const destino = await converterLicitacaoEmCliente(id);
          toast.success("Licitação vencida — cliente atualizado", { id: t });
          router.push(destino);
          router.refresh();
          return;
        }
        await atualizarEtapaLicitacao(id, valor as EtapaSlug);
        toast.success(`Movida para “${nomeEtapa(valor)}”`);
        router.refresh();
      } catch (e) {
        toast.error("Não foi possível atualizar a etapa", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <Select value={etapa} onValueChange={onChange} disabled={pendente}>
      <SelectTrigger size={size} className={className}>
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
