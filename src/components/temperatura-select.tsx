"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TEMPERATURAS, normalizarTemperatura, type Temperatura } from "@/lib/licitacoes/types";
import { atualizarTemperaturaLicitacao } from "@/lib/licitacoes/actions";
import { cn } from "@/lib/utils";

const SEM = "sem";

/** Temperatura da licitação: fria (bolinha azul), morna (laranja) ou quente (vermelha). */
export function TemperaturaSelect({
  id,
  temperatura,
  size = "sm",
  className = "h-8 w-[9.5rem] text-xs",
}: {
  id: string;
  temperatura: Temperatura | null;
  size?: "sm" | "default";
  className?: string;
}) {
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function onChange(valor: string) {
    startTransition(async () => {
      try {
        await atualizarTemperaturaLicitacao(id, normalizarTemperatura(valor));
        router.refresh();
      } catch (e) {
        toast.error("Não foi possível atualizar a temperatura", { description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <Select value={temperatura ?? SEM} onValueChange={onChange} disabled={pendente}>
      <SelectTrigger size={size} className={className} aria-label="Temperatura">
        {pendente ? <Loader2 className="size-3.5 animate-spin" /> : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {TEMPERATURAS.map((t) => (
          <SelectItem key={t.slug} value={t.slug} className="text-xs">
            <span className={cn("size-2 rounded-full", t.ponto)} />
            {t.nome}
          </SelectItem>
        ))}
        <SelectItem value={SEM} className="text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-muted-foreground/40" />
          Temperatura
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
