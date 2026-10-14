import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ehEmpresaSlug, type EmpresaSlug } from "@/lib/empresas";
import type { Cargo } from "@/lib/usuarios/tipos";

export type Acesso = {
  userId: string;
  email: string;
  /** null = conta sem perfil ou bloqueada (não entra em nada). */
  cargo: Cargo | null;
  /** Empresas que a pessoa enxerga (super admin: todas). */
  empresas: EmpresaSlug[];
};

const TODAS: EmpresaSlug[] = ["vital-norte", "rm"];

/** Cargo e empresas do usuário logado (uma consulta por requisição). */
export const obterAcesso = cache(async (): Promise<Acesso | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("usuarios_perfil")
    .select("cargo, empresas, bloqueado_em")
    .eq("user_id", user.id)
    .maybeSingle();

  const base = { userId: user.id, email: user.email ?? "" };
  if (!perfil || perfil.bloqueado_em) return { ...base, cargo: null, empresas: [] };
  if (perfil.cargo === "super_admin") return { ...base, cargo: "super_admin", empresas: TODAS };
  const empresas = ((perfil.empresas as unknown[]) ?? []).filter(ehEmpresaSlug);
  return { ...base, cargo: "admin", empresas };
});

export const podeEmpresa = (a: Acesso | null, slug: EmpresaSlug) => Boolean(a?.cargo && a.empresas.includes(slug));

/** Abre só se a pessoa tem a empresa liberada; senão volta para a Busca. */
export async function exigirEmpresa(slug: EmpresaSlug): Promise<Acesso> {
  const a = await obterAcesso();
  if (!a) redirect("/login");
  if (!podeEmpresa(a, slug)) redirect("/busca");
  return a;
}

/** Só super admin. Devolve o acesso. */
export async function exigirSuperAdmin(): Promise<Acesso> {
  const a = await obterAcesso();
  if (!a) redirect("/login");
  if (a.cargo !== "super_admin") redirect("/configuracoes");
  return a;
}
