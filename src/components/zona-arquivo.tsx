"use client";

import { useEffect, useRef, useState } from "react";
import { FileCheck2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/** Escolher OU arrastar um arquivo. Continua sendo um <input type="file"> dentro do formulário (o envio não muda). */

const ehAceito = (f: File) => f.type === "application/pdf" || f.type.startsWith("image/") || /\.(pdf|png|jpe?g|webp|gif|heic|heif)$/i.test(f.name);
const tamanho = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function ZonaArquivo({ id, name = "arquivo", accept = ".pdf,image/*,application/pdf" }: { id: string; name?: string; accept?: string }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [sobre, setSobre] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // form.reset() (depois do envio) limpa o <input>: limpa o texto também
  useEffect(() => {
    const form = entrada.current?.form;
    if (!form) return;
    const limpar = () => { setArquivo(null); setErro(null); };
    form.addEventListener("reset", limpar);
    return () => form.removeEventListener("reset", limpar);
  }, []);

  function receber(f: File) {
    if (!ehAceito(f)) { setErro("Use um PDF ou uma imagem."); return; }
    const dt = new DataTransfer();
    dt.items.add(f);
    if (entrada.current) entrada.current.files = dt.files; // o formulário lê daqui
    setErro(null);
    setArquivo(f);
  }

  // stopPropagation: o arraste global da Vita (que manda qualquer arquivo solto para o chat) não deve pegar este.
  const parar = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        onDragEnter={(e) => { parar(e); setSobre(true); }}
        onDragOver={(e) => { parar(e); e.dataTransfer.dropEffect = "copy"; setSobre(true); }}
        onDragLeave={(e) => { parar(e); if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(false); }}
        onDrop={(e) => {
          parar(e);
          setSobre(false);
          window.dispatchEvent(new Event("dragend")); // desliga o aviso de arraste da Vita, se estiver ligado
          const f = e.dataTransfer.files?.[0];
          if (f) receber(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
          sobre ? "border-primary bg-primary/10" : arquivo ? "border-primary/40 bg-primary/5" : "border-input hover:border-primary/50 hover:bg-muted/50",
        )}
      >
        <input
          ref={entrada}
          id={id}
          name={name}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0] ?? null; setArquivo(f); setErro(null); }}
        />
        {arquivo ? <FileCheck2 className="size-6 text-primary" /> : <Upload className="size-6 text-muted-foreground" />}
        {arquivo ? (
          <>
            <span className="max-w-full truncate text-sm font-medium">{arquivo.name}</span>
            <span className="text-xs text-muted-foreground">{tamanho(arquivo.size)} · clique ou arraste outro para trocar</span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">{sobre ? "Solte o arquivo aqui" : "Arraste o arquivo aqui"}</span>
            <span className="text-xs text-muted-foreground">ou clique para escolher (PDF ou imagem)</span>
          </>
        )}
      </label>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
