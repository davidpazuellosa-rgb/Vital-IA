"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Refaz a busca ao vivo no PNCP (recarrega os dados da página). */
export function TentarNovamente({ rotulo = "Tentar novamente" }: { rotulo?: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={pendente} onClick={() => iniciar(() => router.refresh())}>
      {pendente ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {rotulo}
    </Button>
  );
}
