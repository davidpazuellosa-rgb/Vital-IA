"use server";

import { revalidatePath } from "next/cache";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { createClient } from "@/lib/supabase/server";
import { normalizarItem } from "./types";

const CAMINHO = "/vital-norte/catalogo";

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

export async function criarItemCatalogo(formData: FormData) {
  const { supabase, user } = await sessao();
  const empresa = await resolverEmpresaUserId(supabase, user.id);
  const { error } = await supabase.from("catalogo_itens").insert({ ...normalizarItem(camposDoForm(formData)), user_id: empresa });
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}

export async function atualizarItemCatalogo(id: string, formData: FormData) {
  const { supabase } = await sessao();
  const { error } = await supabase
    .from("catalogo_itens")
    .update({ ...normalizarItem(camposDoForm(formData)), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}

export async function removerItemCatalogo(id: string) {
  const { supabase } = await sessao();
  const { error } = await supabase.from("catalogo_itens").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}
