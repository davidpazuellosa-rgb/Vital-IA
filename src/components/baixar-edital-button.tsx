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
  const [baixando, setBaixando] = useState(false);

  async function baixar() {
    setBaixando(true);
    const t = toast.loading("Baixando edital…", { description: "Empacotando os arquivos do PNCP." });
    try {
      const res = await fetch(`/api/licitacoes/edital-zip?n=${encodeURIComponent(numeroControle)}`);
      if (!res.ok) {
        const corpo = await res.json().catch(() => null);
        throw new Error(corpo?.error ?? "Falha ao baixar o edital.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edital-${numeroControle.replace(/[^\w]/g, "_")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Edital baixado", { id: t });
    } catch (e) {
      toast.error("Não foi possível baixar", { id: t, description: e instanceof Error ? e.message : undefined });
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Button variant="outline" className="justify-start" onClick={baixar} disabled={!disponivel || baixando}>
      {baixando ? <Loader2 className="animate-spin" /> : <Download />}
      Baixar edital (ZIP)
      {!disponivel && <span className="ml-auto text-xs text-muted-foreground">indisponível</span>}
    </Button>
  );
}
