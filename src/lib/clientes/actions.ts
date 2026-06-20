"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_AVULSO } from "./types";

const BUCKET = "documentos";

export async function criarCliente(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const nome = ((formData.get("nome") as string) ?? "").trim();
  const orgao = ((formData.get("orgao") as string) ?? "").trim();
  if (!nome) throw new Error("Informe o nome do cliente.");

  const { data, error } = await supabase
    .from("clientes")
    .insert({ user_id: user.id, nome, orgao })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/clientes");
  return data.id as string;
}

export async function removerCliente(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  // remove arquivos do storage (best-effort)
  const { data: docs } = await supabase
    .from("cliente_documentos")
    .select("arquivo_path")
    .eq("cliente_id", id)
    .eq("user_id", user.id);
  const paths = (docs ?? []).map((d) => d.arquivo_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);

  const { error } = await supabase.from("clientes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/clientes");
}

export async function atualizarClienteStatus(id: string, status: string, proximoPasso: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("clientes")
    .update({ status: status.trim(), proximo_passo: proximoPasso.trim() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${id}`);
}

export async function criarContratacao(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const clienteId = (formData.get("clienteId") as string) ?? "";
  const titulo = ((formData.get("titulo") as string) ?? "").trim();
  const identificador = ((formData.get("identificador") as string) ?? "").trim();
  if (!clienteId) throw new Error("Cliente inválido.");
  if (!titulo) throw new Error("Informe o título da licitação/contratação.");

  const { data, error } = await supabase
    .from("contratacoes")
    .insert({ cliente_id: clienteId, user_id: user.id, titulo, identificador })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${clienteId}`);
  return data.id as string;
}

export async function removerContratacao(id: string, clienteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: docs } = await supabase
    .from("cliente_documentos")
    .select("arquivo_path")
    .eq("contratacao_id", id)
    .eq("user_id", user.id);
  const paths = (docs ?? []).map((d) => d.arquivo_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);

  const { error } = await supabase.from("contratacoes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${clienteId}`);
}

export async function atualizarContratacaoStatus(id: string, clienteId: string, status: string, proximoPasso: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("contratacoes")
    .update({ status: status.trim(), proximo_passo: proximoPasso.trim() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${clienteId}/contratacao/${id}`);
}

export type RegistrarClienteDocInput = {
  clienteId: string;
  contratacaoId: string;
  tipo: string;
  nome: string;
  path: string;
  arquivoNome: string;
};

export async function registrarClienteDocumento(input: RegistrarClienteDocInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  if (!input.path.startsWith(`${user.id}/`)) throw new Error("Caminho de arquivo inválido.");

  const { error } = await supabase.from("cliente_documentos").insert({
    cliente_id: input.clienteId,
    contratacao_id: input.contratacaoId,
    user_id: user.id,
    tipo: input.tipo || CATEGORIA_AVULSO,
    nome: input.nome,
    arquivo_path: input.path,
    arquivo_nome: input.arquivoNome,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([input.path]);
    throw new Error(error.message);
  }
  revalidatePath(`/vital-norte/clientes/${input.clienteId}/contratacao/${input.contratacaoId}`);
}

export async function removerClienteDocumento(id: string, clienteId: string, contratacaoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: doc } = await supabase
    .from("cliente_documentos")
    .select("arquivo_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (doc?.arquivo_path) await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);

  const { error } = await supabase.from("cliente_documentos").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${clienteId}/contratacao/${contratacaoId}`);
}
