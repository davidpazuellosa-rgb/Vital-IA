"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Texto quando nada está selecionado. */
  placeholder: string;
  /** Mostra o campo de pesquisa dentro da lista (útil para listas longas). */
  searchable?: boolean;
  /** "estados" → "3 estados selecionados". */
  plural?: string;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Dropdown de seleção múltipla: resume a escolha no botão e abre uma lista com marcação.
 * A lista vive num portal (Popover), então não é cortada pelo card em que o campo está.
 */
export function MultiSelect({ options, selected, onChange, placeholder, searchable, plural = "itens" }: MultiSelectProps) {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const listaId = useId();

  const visiveis = useMemo(() => {
    const f = semAcento(filtro.trim());
    return f ? options.filter((o) => semAcento(o.label).includes(f)) : options;
  }, [options, filtro]);

  function alternar(valor: string) {
    onChange(selected.includes(valor) ? selected.filter((v) => v !== valor) : [...selected, valor]);
  }

  const rotulos = selected.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const resumo =
    selected.length === 0
      ? null
      : selected.length <= 2
        ? rotulos.join(", ")
        : `${selected.length} ${plural} selecionados`;

  return (
    <Popover open={aberto} onOpenChange={(v) => { setAberto(v); if (v) setFiltro(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-controls={listaId}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-colors",
            "hover:bg-muted/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            aberto && "border-ring ring-[3px] ring-ring/50",
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !resumo && "text-muted-foreground")}>{resumo ?? placeholder}</span>
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpar seleção"
              title="Limpar"
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); onChange([]); } }}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
        </button>
      </PopoverTrigger>

      <PopoverContent>
        {searchable && (
          <div className="relative border-b p-1.5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Pesquisar…"
              className="h-8 w-full rounded bg-transparent pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        )}
        <ul id={listaId} role="listbox" aria-multiselectable className="max-h-64 overflow-auto p-1">
          {visiveis.length === 0 && <li className="px-2 py-3 text-center text-sm text-muted-foreground">Nada encontrado</li>}
          {visiveis.map((o) => {
            const ativo = selected.includes(o.value);
            return (
              <li key={o.value} role="option" aria-selected={ativo}>
                <button
                  type="button"
                  onClick={() => alternar(o.value)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
                      ativo ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {ativo && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between border-t px-2 py-1.5 text-xs">
          <button type="button" onClick={() => onChange([])} disabled={selected.length === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-40">
            Limpar
          </button>
          <button
            type="button"
            onClick={() => onChange(Array.from(new Set([...selected, ...visiveis.map((o) => o.value)])))}
            className="font-medium text-primary hover:underline"
          >
            {filtro ? "Marcar os resultados" : "Marcar todos"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
