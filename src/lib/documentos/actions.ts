"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extrairDatasDoPdf } from "./extract";
import { TIPO_AVULSO, tipoSemValidade } from "./types";

const BUCKET = "documentos";

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

  // segurança: o arquivo precisa estar sob o prefixo do próprio usuário
  if (!input.path.startsWith(`${user.id}/`)) {
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
    user_id: user.id,
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
