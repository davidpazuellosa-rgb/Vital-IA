"use server";

import { revalidatePath } from "next/cache";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { createClient } from "@/lib/supabase/server";
import { configEmpresa, type EmpresaSlug } from "@/lib/empresas";
import { normalizarItem } from "./types";

async function sessao() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return { supabase, user };
}

function camposDoForm(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = Object.fromEntries(formData.entries());
  obj.ativo = formData.get("ativo") !== "false";
  return obj;
}

export async function criarItemCatalogo(formData: FormData, empresa?: EmpresaSlug) {
  const cfg = configEmpresa(empresa);
  const { supabase, user } = await sessao();
  const donoEmpresa = await resolverEmpresaUserId(supabase, user.id);
  const { error } = await supabase.from(cfg.tabelaCatalogo).insert({ ...normalizarItem(camposDoForm(formData)), user_id: donoEmpresa });
  if (error) throw new Error(error.message);
  revalidatePath(cfg.rotaCatalogo);
}

export async function atualizarItemCatalogo(id: string, formData: FormData, empresa?: EmpresaSlug) {
  const cfg = configEmpresa(empresa);
  const { supabase } = await sessao();
  const { error } = await supabase
    .from(cfg.tabelaCatalogo)
    .update({ ...normalizarItem(camposDoForm(formData)), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(cfg.rotaCatalogo);
}

export async function removerItemCatalogo(id: string, empresa?: EmpresaSlug) {
  const cfg = configEmpresa(empresa);
  const { supabase } = await sessao();
  const { error } = await supabase.from(cfg.tabelaCatalogo).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(cfg.rotaCatalogo);
}
