"use server";

import { revalidatePath } from "next/cache";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { createClient } from "@/lib/supabase/server";
import { IDS_CATEGORIA, NOMES_FERRAMENTAS } from "./catalogo-ferramentas";
import type { Memoria } from "./memoria";

/* Ações da página "Vita": memórias e ferramentas. Sempre com a sessão do usuário (RLS de empresa). */

async function sessao() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresa = await resolverEmpresaUserId(supabase, user.id);
  return { supabase, empresa };
}

const limpar = (s: string) => s.replace(/\s+/g, " ").trim();
function validar(conteudo: string, categoria: string) {
  const c = limpar(conteudo);
  if (c.length < 3) throw new Error("Escreva a memória em uma frase.");
  if (c.length > 600) throw new Error("Memória longa demais (máx. 600 caracteres).");
  return { conteudo: c, categoria: IDS_CATEGORIA.includes(categoria) ? categoria : "geral" };
}

export async function criarMemoria(conteudo: string, categoria: string): Promise<Memoria> {
  const { supabase, empresa } = await sessao();
  const v = validar(conteudo, categoria);
  const { data, error } = await supabase
    .from("vita_memorias")
    .insert({ user_id: empresa, ...v, origem: "usuario" })
    .select("id, conteudo, categoria, origem, ativo, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/vita");
  return data as Memoria;
}

export async function atualizarMemoria(id: string, campos: { conteudo?: string; categoria?: string; ativo?: boolean }) {
  const { supabase } = await sessao();
  const mudar: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (campos.conteudo !== undefined || campos.categoria !== undefined) {
    const v = validar(campos.conteudo ?? "", campos.categoria ?? "geral");
    if (campos.conteudo !== undefined) mudar.conteudo = v.conteudo;
    if (campos.categoria !== undefined) mudar.categoria = v.categoria;
  }
  if (campos.ativo !== undefined) mudar.ativo = campos.ativo;
  const { error } = await supabase.from("vita_memorias").update(mudar).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vita");
}

export async function removerMemoria(id: string) {
  const { supabase } = await sessao();
  const { error } = await supabase.from("vita_memorias").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vita");
}

async function garantirConfig(supabase: Awaited<ReturnType<typeof sessao>>["supabase"], empresa: string) {
  const { data } = await supabase.from("vita_configuracao").select("user_id, ferramentas_desativadas").eq("user_id", empresa).maybeSingle();
  if (data) return (data.ferramentas_desativadas as string[]) ?? [];
  const { error } = await supabase.from("vita_configuracao").insert({ user_id: empresa });
  if (error) throw new Error(error.message);
  return [];
}

export async function definirMemoriaConfig(campos: { memoriaAtiva?: boolean; memoriaAutomatica?: boolean }) {
  const { supabase, empresa } = await sessao();
  await garantirConfig(supabase, empresa);
  const mudar: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (campos.memoriaAtiva !== undefined) mudar.memoria_ativa = campos.memoriaAtiva;
  if (campos.memoriaAutomatica !== undefined) mudar.memoria_automatica = campos.memoriaAutomatica;
  const { error } = await supabase.from("vita_configuracao").update(mudar).eq("user_id", empresa);
  if (error) throw new Error(error.message);
  revalidatePath("/vita");
}

/** Liga/desliga uma ferramenta (as desligadas não são oferecidas à Vita nem executadas). */
export async function definirFerramenta(nome: string, ativa: boolean) {
  if (!NOMES_FERRAMENTAS.includes(nome)) throw new Error("Ferramenta desconhecida.");
  const { supabase, empresa } = await sessao();
  const atuais = await garantirConfig(supabase, empresa);
  const proximas = ativa ? atuais.filter((n) => n !== nome) : [...new Set([...atuais, nome])];
  const { error } = await supabase
    .from("vita_configuracao")
    .update({ ferramentas_desativadas: proximas, updated_at: new Date().toISOString() })
    .eq("user_id", empresa);
  if (error) throw new Error(error.message);
  revalidatePath("/vita");
}
