"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";

type Sugestao = { nome: string; uf: string; municipio: string; qtd: number };

interface OrgaoComboboxProps {
  value: string;
  onChange: (valor: string) => void;
}

/**
 * Campo de órgão com sugestões: ao digitar (3+ letras) consulta o PNCP e lista os órgãos com o
 * nome OFICIAL (ex.: "MUNICIPIO DE LUISBURGO"). Escolher uma sugestão preenche o campo; dá
 * para continuar digitando livremente.
 */
export function OrgaoCombobox({ value, onChange }: OrgaoComboboxProps) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [consultado, setConsultado] = useState("");
  const [ativo, setAtivo] = useState(-1);
  const raiz = useRef<HTMLDivElement>(null);
  const pulaConsulta = useRef(false); // não consultar logo após escolher uma sugestão

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (pulaConsulta.current) { pulaConsulta.current = false; return; }
    const texto = value.trim();
    if (texto.length < 3) { setSugestoes([]); setConsultado(""); return; }
    const controlador = new AbortController();
    const espera = setTimeout(async () => {
      setCarregando(true);
      try {
        const res = await fetch(`/api/licitacoes/orgaos?q=${encodeURIComponent(texto)}`, { signal: controlador.signal });
        const json = (await res.json()) as { orgaos?: Sugestao[] };
        setSugestoes(json.orgaos ?? []);
        setConsultado(texto);
        setAtivo(-1);
      } catch {
        /* cancelada ou sem rede */
      } finally {
        if (!controlador.signal.aborted) setCarregando(false);
      }
    }, 350);
    return () => { clearTimeout(espera); controlador.abort(); };
  }, [value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function escolher(s: Sugestao) {
    pulaConsulta.current = true;
    onChange(s.nome);
    setAberto(false);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!aberto || sugestoes.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((i) => (i + 1) % sugestoes.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((i) => (i <= 0 ? sugestoes.length - 1 : i - 1)); }
    else if (e.key === "Enter" && ativo >= 0) { e.preventDefault(); escolher(sugestoes[ativo]); }
    else if (e.key === "Escape") setAberto(false);
  }

  const mostrarLista = aberto && value.trim().length >= 3 && (carregando || consultado === value.trim());

  return (
    <div ref={raiz} className="relative">
      <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onKeyDown={aoTeclar}
        placeholder="ex: Município de Manaus, Secretaria…"
        autoComplete="off"
        className="pl-9 pr-8"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        {carregando ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : value ? (
          <button type="button" onClick={() => onChange("")} aria-label="Limpar órgão" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {mostrarLista && (
        <div className="absolute z-50 mt-1 w-full min-w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          {carregando && sugestoes.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Buscando órgãos…</p>
          ) : sugestoes.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum órgão encontrado — a busca ainda usará o texto digitado.</p>
          ) : (
            <ul role="listbox" className="max-h-64 overflow-auto p-1">
              {sugestoes.map((s, i) => (
                <li key={`${s.nome}-${s.uf}`} role="option" aria-selected={i === ativo}>
                  <button
                    type="button"
                    onClick={() => escolher(s)}
                    onMouseEnter={() => setAtivo(i)}
                    className={`flex w-full flex-col rounded px-2 py-1.5 text-left text-sm ${i === ativo ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"}`}
                  >
                    <span className="truncate font-medium">{s.nome}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[s.municipio, s.uf].filter(Boolean).join(" / ")} · {s.qtd} edital(is) na pesquisa
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
