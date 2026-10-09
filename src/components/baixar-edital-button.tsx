"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BaixarEditalButton({
  numeroControle,
  disponivel,
}: {
  numeroControle: string;
  disponivel: boolean;
}) {
  const [preparando, setPreparando] = useState(false);

  async function baixar() {
    setPreparando(true);
    const base = `/api/licitacoes/edital-zip?n=${encodeURIComponent(numeroControle)}`;
    try {
      // Confere rápido se há arquivos (e se o PNCP responde) antes de iniciar o download.
      const res = await fetch(`${base}&verificar=1`);
      if (!res.ok) {
        const corpo = await res.json().catch(() => null);
        throw new Error(corpo?.error ?? "Falha ao preparar o download do edital.");
      }
      // O ZIP vem em fluxo: o próprio navegador conduz o download (com andamento) — sem segurar uma
      // requisição de minutos na página, que era o que falhava com o PNCP lento.
      const a = document.createElement("a");
      a.href = base;
      a.download = `edital-${numeroControle.replace(/[^\w]/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Download do edital iniciado", {
        description: "O PNCP costuma ser lento: acompanhe o andamento na lista de downloads do navegador.",
        duration: 8000,
      });
    } catch (e) {
      toast.error("Não foi possível baixar", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setPreparando(false);
    }
  }

  return (
    <Button variant="outline" className="justify-start" onClick={baixar} disabled={!disponivel || preparando}>
      {preparando ? <Loader2 className="animate-spin" /> : <Download />}
      Baixar edital (ZIP)
      {!disponivel && <span className="ml-auto text-xs text-muted-foreground">indisponível</span>}
    </Button>
  );
}
