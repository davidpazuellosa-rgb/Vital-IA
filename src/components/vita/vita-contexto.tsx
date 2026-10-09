"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CHAVE = "vitalia:vita";
export const LARGURA_PADRAO = 420;
export const LARGURA_MIN = 340;
export const LARGURA_MAX = 720;

type EstadoVita = {
  aberto: boolean;
  largura: number;
  /** false até ler o estado salvo — evita animar o painel ao carregar a página. */
  pronto: boolean;
  /** Tela cheia: ocupa a página até a barra lateral, com a lista de conversas à esquerda. */
  expandido: boolean;
  alternarExpandido: () => void;
  alternar: () => void;
  abrir: () => void;
  fechar: () => void;
  definirLargura: (px: number) => void;
};

const Contexto = createContext<EstadoVita | null>(null);

export function useVita(): EstadoVita {
  const v = useContext(Contexto);
  if (!v) throw new Error("useVita precisa estar dentro de <VitaProvider>.");
  return v;
}

export function VitaProvider({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [largura, setLargura] = useState(LARGURA_PADRAO);
  const [pronto, setPronto] = useState(false);
  const [expandido, setExpandido] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "{}") as { aberto?: boolean; largura?: number; expandido?: boolean };
      if (typeof salvo.aberto === "boolean") setAberto(salvo.aberto);
      if (salvo.aberto && salvo.expandido === true) setExpandido(true);
      if (typeof salvo.largura === "number") setLargura(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, salvo.largura)));
    } catch { /* armazenamento indisponível */ }
    const t = requestAnimationFrame(() => setPronto(true));
    return () => cancelAnimationFrame(t);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!pronto) return;
    try { localStorage.setItem(CHAVE, JSON.stringify({ aberto, largura, expandido })); } catch { /* ignora */ }
  }, [aberto, largura, expandido, pronto]);

  // Fechar sempre volta ao modo painel (na próxima abertura ela abre lateral).
  const alternar = useCallback(() => setAberto((v) => { if (v) setExpandido(false); return !v; }), []);
  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => { setAberto(false); setExpandido(false); }, []);
  const alternarExpandido = useCallback(() => setExpandido((v) => !v), []);
  const definirLargura = useCallback((px: number) => setLargura(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, Math.round(px)))), []);

  // Atalho ⌘J / Ctrl+J
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        alternar();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [alternar]);

  const valor = useMemo(
    () => ({ aberto, largura, pronto, expandido, alternarExpandido, alternar, abrir, fechar, definirLargura }),
    [aberto, largura, pronto, expandido, alternarExpandido, alternar, abrir, fechar, definirLargura],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
