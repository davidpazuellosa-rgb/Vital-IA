"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Alerta = {
  id: string;
  nome: string;
  keyword: string;
  ufs: string[];
  modalidades: number[];
  valor_min: number | null;
  valor_max: number | null;
  apenas_aberto: boolean;
  ativo: boolean;
  ultima_execucao: string | null;
  created_at: string;
};

function parseLista(valor: FormDataEntryValue | null): string[] {
  return ((valor as string) ?? "")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
}

function parseNumero(valor: FormDataEntryValue | null): number | null {
  const n = Number((valor as string) ?? "");
  return Number.isFinite(n) && (valor as string)?.trim() ? n : null;
}

export async function salvarAlerta(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const id = (formData.get("id") as string) || null;
  const nome = ((formData.get("nome") as string) ?? "").trim();
  if (!nome) throw new Error("Dê um nome ao alerta.");

  const modalidades = parseLista(formData.get("modalidades"))
    .map((m) => Number(m))
    .filter((n) => Number.isFinite(n));

  const valores = {
    user_id: user.id,
    nome,
    keyword: ((formData.get("keyword") as string) ?? "").trim(),
    ufs: parseLista(formData.get("ufs")),
    modalidades,
    valor_min: parseNumero(formData.get("valor_min")),
    valor_max: parseNumero(formData.get("valor_max")),
    apenas_aberto: formData.get("apenas_aberto") === "on" || formData.get("apenas_aberto") === "true",
    ativo: true,
  };

  if (id) {
    const { error } = await supabase.from("alertas").update(valores).eq("id", id).eq("user_id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("alertas").insert(valores);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/vital-norte/alertas");
}

export async function alternarAlerta(id: string, ativo: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { error } = await supabase.from("alertas").update({ ativo }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/alertas");
}

export async function removerAlerta(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { error } = await supabase.from("alertas").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/alertas");
}
