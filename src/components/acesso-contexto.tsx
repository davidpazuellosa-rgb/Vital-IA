"use client";

import { cloneElement, createContext, useContext, type ReactElement } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EMPRESAS, type EmpresaSlug } from "@/lib/empresas";

const Contexto = createContext<EmpresaSlug[]>([]);

/** Empresas que o usuário logado enxerga (vem do servidor, no layout). */
export function AcessoProvider({ empresas, children }: { empresas: EmpresaSlug[]; children: React.ReactNode }) {
  return <Contexto.Provider value={empresas}>{children}</Contexto.Provider>;
}

export const useEmpresasDoUsuario = () => useContext(Contexto);

/** Botão que escolhe a empresa: com uma só empresa age direto; com duas abre o menu "Vital Norte / RM". */
export function EscolherEmpresa({ onEscolher, children }: { onEscolher: (empresa: EmpresaSlug) => void; children: ReactElement<{ onClick?: () => void }> }) {
  const empresas = useEmpresasDoUsuario();
  if (empresas.length <= 1) {
    return cloneElement(children, { onClick: () => onEscolher(empresas[0] ?? "vital-norte") });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {empresas.map((e) => (
          <DropdownMenuItem key={e} onSelect={() => onEscolher(e)}>{EMPRESAS[e].nome}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
