"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { REPRESENTANTES_LEGAIS, type PropostaItem } from "./types";

function texto(formData: FormData, campo: string): string {
  return ((formData.get(campo) as string) ?? "").trim();
}

function numero(valor: FormDataEntryValue | null): number | null {
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const convertido = Number(valor.replace(",", "."));
  return Number.isFinite(convertido) ? convertido : null;
}

export async function salvarConfiguracaoProposta(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const validade = numero(formData.get("validade_dias"));
  const representante = REPRESENTANTES_LEGAIS.find(
    (item) => item.nome === texto(formData, "representante_legal"),
  );
  const { error } = await supabase.from("proposta_configuracao").upsert({
    user_id: user.id,
    validade_dias: validade && validade > 0 ? Math.round(validade) : 60,
    impostos_inclusos: formData.get("impostos_inclusos") === "on",
    representante_legal: representante?.nome ?? "",
    representante_cargo: representante?.cargo ?? "",
    observacoes_padrao: texto(formData, "observacoes_padrao"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/dados");
}

export async function salvarRascunhoProposta(licitacaoId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: licitacao } = await supabase
    .from("saved_licitacoes")
    .select("id")
    .eq("id", licitacaoId)
    .eq("user_id", user.id)
    .single();
  if (!licitacao) throw new Error("Licitação não encontrada");

  const numeros = formData.getAll("item_numero").map((valor) => Number(valor));
  const itens: PropostaItem[] = numeros.map((itemNumero) => ({
    numero: itemNumero,
    descricao: texto(formData, `item_${itemNumero}_descricao`),
    quantidade: numero(formData.get(`item_${itemNumero}_quantidade`)),
    unidade: texto(formData, `item_${itemNumero}_unidade`),
    marca: texto(formData, `item_${itemNumero}_marca`),
    valor_unitario: numero(formData.get(`item_${itemNumero}_valor_unitario`)),
  }));

  const validade = numero(formData.get("validade_dias"));
  const status = itens.length > 0 && itens.every((item) => item.valor_unitario !== null)
    ? "pronta"
    : "rascunho";
  const { error } = await supabase.from("propostas").upsert({
    user_id: user.id,
    licitacao_id: licitacaoId,
    status,
    validade_dias: validade && validade > 0 ? Math.round(validade) : 60,
    prazo_entrega: texto(formData, "prazo_entrega"),
    condicoes_pagamento: texto(formData, "condicoes_pagamento"),
    observacoes: texto(formData, "observacoes"),
    itens,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,licitacao_id" });

  if (error) throw new Error(error.message);
  revalidatePath(`/licitacao/${licitacaoId}/proposta`);
  revalidatePath("/minhas-licitacoes");
}
