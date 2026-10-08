"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";

const CAMINHO = "/vital-norte/sistemas";

/** Aceita "bllcompras.com" ou "https://…"; recusa qualquer coisa que não seja http(s). */
function normalizarUrl(bruta: string): string {
  const texto = bruta.trim();
  if (!texto) throw new Error("Informe o endereço do sistema.");
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(texto) ? texto : `https://${texto}`;
  let url: URL;
  try {
    url = new URL(comEsquema);
  } catch {
    throw new Error("Endereço inválido.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Use um endereço http(s).");
  return url.toString();
}

function lerCampos(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Informe o nome do sistema.");
  return {
    nome,
    url: normalizarUrl(String(formData.get("url") ?? "")),
    login: String(formData.get("login") ?? "").trim(),
    observacoes: String(formData.get("observacoes") ?? "").trim(),
  };
}

export async function criarSistema(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

  const { data: ultimo } = await supabase
    .from("sistemas_licitacao")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("sistemas_licitacao").insert({
    ...lerCampos(formData),
    user_id: empresaUserId,
    ordem: (ultimo?.ordem ?? 0) + 1,
  });
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}

export async function atualizarSistema(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase.from("sistemas_licitacao").update(lerCampos(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}

export async function removerSistema(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase.from("sistemas_licitacao").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(CAMINHO);
}
