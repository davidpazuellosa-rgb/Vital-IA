"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extrairDatasDoPdf } from "./extract";
import { TIPO_AVULSO } from "./types";

const BUCKET = "documentos";

function sanitizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .slice(-120);
}

export async function uploadDocumento(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const file = formData.get("arquivo");
  const tipo = (formData.get("tipo") as string) || TIPO_AVULSO;
  const nomeInformado = (formData.get("nome") as string)?.trim();

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Selecione um arquivo válido.");
  }

  const id = crypto.randomUUID();
  const arquivoNome = sanitizarNome(file.name);
  const path = `${user.id}/${id}/${arquivoNome}`;
  const buffer = await file.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

  // Extração automática da data de validade (apenas PDFs com texto)
  let dataValidade: string | null = null;
  let dataEmissao: string | null = null;
  if (file.type === "application/pdf" || arquivoNome.toLowerCase().endsWith(".pdf")) {
    const datas = await extrairDatasDoPdf(buffer);
    dataValidade = datas.dataValidade;
    dataEmissao = datas.dataEmissao;
  }

  const { error: insErr } = await supabase.from("documentos").insert({
    id,
    user_id: user.id,
    tipo,
    nome: nomeInformado || file.name,
    arquivo_path: path,
    arquivo_nome: file.name,
    data_emissao: dataEmissao,
    data_validade: dataValidade,
    validade_automatica: dataValidade != null,
  });
  if (insErr) {
    // desfaz o upload para não deixar arquivo órfão
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(insErr.message);
  }

  revalidatePath("/documentos");
}

export async function removerDocumento(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: doc } = await supabase
    .from("documentos")
    .select("arquivo_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (doc?.arquivo_path) {
    await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);
  }

  const { error } = await supabase.from("documentos").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}

export async function atualizarValidade(id: string, dataValidade: string | null) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("documentos")
    .update({ data_validade: dataValidade || null, validade_automatica: false })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/documentos");
}
