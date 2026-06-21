"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaUserId } from "./escopo";

export type EmpresaDados = {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  porte: string;
  natureza_juridica: string;
  data_abertura: string | null;
  cnae_principal: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  email: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  dados_bancarios: string;
};

const CAMPOS: (keyof EmpresaDados)[] = [
  "razao_social", "nome_fantasia", "cnpj", "porte", "natureza_juridica", "data_abertura",
  "cnae_principal", "inscricao_estadual", "inscricao_municipal", "email", "telefone",
  "cep", "logradouro", "numero", "complemento", "bairro", "municipio", "uf", "dados_bancarios",
];

export async function salvarEmpresa(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

  const valores: Record<string, string | null> = { user_id: empresaUserId, updated_at: new Date().toISOString() };
  for (const campo of CAMPOS) {
    const v = ((formData.get(campo) as string) ?? "").trim();
    valores[campo] = campo === "data_abertura" ? (v || null) : v;
  }

  const { error } = await supabase.from("empresa").upsert(valores, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/dados");
}
