/* Tipos e rótulos de usuários/cargos. Seguro para servidor e navegador. */
import type { EmpresaSlug } from "@/lib/empresas";

export type Cargo = "super_admin" | "admin";

export const CARGOS: Record<Cargo, string> = { super_admin: "Super admin", admin: "Admin" };

export type StatusUsuario = "ativo" | "pendente" | "expirado" | "bloqueado";

export type UsuarioLinha = {
  id: string;
  email: string;
  nome: string;
  cargo: Cargo;
  empresas: EmpresaSlug[];
  status: StatusUsuario;
};

export const VALIDADE_CONVITE_DIAS = 7;
export const MIN_SENHA = 8;
