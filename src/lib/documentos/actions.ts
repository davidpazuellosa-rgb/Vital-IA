"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { extrairDatasDoPdf } from "./extract";
import { TIPO_AVULSO, tipoSemValidade } from "./types";

const BUCKET = "documentos";

export async function obterEmpresaUserId(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return resolverEmpresaUserId(supabase, user.id);
}

export type RegistrarDocumentoInput = {
  id: string;
  tipo: string;
  nome: string;
  path: string;
  arquivoNome: string;
  mimeType: string;
};

/**
 * Registra um documento já enviado direto pelo navegador ao Storage.
 * O arquivo não passa pelo Server Action (evita o limite de body de 1MB
 * e o limite de request do Vercel). Aqui só baixamos o arquivo do Storage
 * para extrair a data de validade e gravamos a linha no banco.
 */
export async function registrarDocumento(input: RegistrarDocumentoInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

  // segurança: o arquivo precisa estar sob o prefixo da empresa vinculada
  if (!input.path.startsWith(`${empresaUserId}/`)) {
    throw new Error("Caminho de arquivo inválido.");
  }

  // Extração automática da data de validade (apenas PDFs com texto e tipos que expiram)
  let dataValidade: string | null = null;
  let dataEmissao: string | null = null;
  const ehPdf = input.mimeType === "application/pdf" || input.arquivoNome.toLowerCase().endsWith(".pdf");
  if (ehPdf && !tipoSemValidade(input.tipo)) {
    const { data: blob } = await supabase.storage.from(BUCKET).download(input.path);
    if (blob) {
      const datas = await extrairDatasDoPdf(await blob.arrayBuffer());
      dataValidade = datas.dataValidade;
      dataEmissao = datas.dataEmissao;
    }
  }

  const { error: insErr } = await supabase.from("documentos").insert({
    id: input.id,
    user_id: empresaUserId,
    tipo: input.tipo || TIPO_AVULSO,
    nome: input.nome,
    arquivo_path: input.path,
    arquivo_nome: input.arquivoNome,
    data_emissao: dataEmissao,
    data_validade: dataValidade,
    validade_automatica: dataValidade != null,
  });
  if (insErr) {
    // desfaz o upload para não deixar arquivo órfão
    await supabase.storage.from(BUCKET).remove([input.path]);
    throw new Error(insErr.message);
  }

  revalidatePath("/documentos");
}

export type SubstituirDocumentoInput = {
  id: string;
  path: string;
  arquivoNome: string;
  mimeType: string;
};

/**
 * Substitui o arquivo de um documento já cadastrado (2ª via), mantendo o
 * mesmo id/tipo/nome. Reextrai a data de validade do novo arquivo — mesma
 * lógica do cadastro inicial — e remove o arquivo antigo do Storage.
 */
export async function substituirDocumento(input: SubstituirDocumentoInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

  if (!input.path.startsWith(`${empresaUserId}/`)) {
    throw new Error("Caminho de arquivo inválido.");
  }

  const { data: doc, error: docErr } = await supabase
    .from("documentos")
    .select("arquivo_path, tipo")
    .eq("id", input.id)
    .eq("user_id", empresaUserId)
    .single();
  if (docErr || !doc) throw new Error("Documento não encontrado.");

  let dataValidade: string | null = null;
  let dataEmissao: string | null = null;
  const ehPdf = input.mimeType === "application/pdf" || input.arquivoNome.toLowerCase().endsWith(".pdf");
  if (ehPdf && !tipoSemValidade(doc.tipo)) {
    const { data: blob } = await supabase.storage.from(BUCKET).download(input.path);
    if (blob) {
      const datas = await extrairDatasDoPdf(await blob.arrayBuffer());
      dataValidade = datas.dataValidade;
      dataEmissao = datas.dataEmissao;
    }
  }

  const { error: updErr } = await supabase
    .from("documentos")
    .update({
      arquivo_path: input.path,
      arquivo_nome: input.arquivoNome,
      data_emissao: dataEmissao,
      data_validade: dataValidade,
      validade_automatica: dataValidade != null,
    })
    .eq("id", input.id)
    .eq("user_id", empresaUserId);

  if (updErr) {
    // desfaz o upload do novo arquivo para não deixar órfão
    await supabase.storage.from(BUCKET).remove([input.path]);
    throw new Error(updErr.message);
  }

  // Remove o arquivo antigo do Storage (o banco já aponta para o novo).
  if (doc.arquivo_path && doc.arquivo_path !== input.path) {
    await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
  }

  revalidatePath("/documentos");
}

export async function removerDocumento(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

  const { data: doc } = await supabase
    .from("documentos")
    .select("arquivo_path")
    .eq("id", id)
    .eq("user_id", empresaUserId)
    .single();

  if (doc?.arquivo_path) {
    await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
  }

  const { error } = await supabase.from("documentos").delete().eq("id", id).eq("user_id", empresaUserId);
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}

export async function renomearDocumento(id: string, nome: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

  const limpo = nome.trim();
  if (!limpo) throw new Error("Informe um nome.");

  const { error } = await supabase
    .from("documentos")
    .update({ nome: limpo })
    .eq("id", id)
    .eq("user_id", empresaUserId);
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}

export async function atualizarValidade(id: string, dataValidade: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

  const { error } = await supabase
    .from("documentos")
    .update({ data_validade: dataValidade || null, validade_automatica: false })
    .eq("id", id)
    .eq("user_id", empresaUserId);
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}
