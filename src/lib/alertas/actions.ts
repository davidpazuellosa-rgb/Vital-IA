"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enviarTelegram } from "@/lib/notificacoes/telegram";

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

function erroColunaTelegramToken(error: { code?: string; message: string } | null): boolean {
  return Boolean(
    error?.message.includes("telegram_bot_token") &&
      (error.code === "PGRST204" || error.message.includes("does not exist")),
  );
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

export async function enviarTesteTelegram(botToken?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  let { data, error: configError }: {
    data: { telegram_chat_id?: string | null; telegram_bot_token?: string | null } | null;
    error: { code?: string; message: string } | null;
  } = await supabase
    .from("notificacoes_config")
    .select("telegram_chat_id, telegram_bot_token")
    .eq("user_id", user.id)
    .maybeSingle();
  if (erroColunaTelegramToken(configError)) {
    const fallback = await supabase
      .from("notificacoes_config")
      .select("telegram_chat_id")
      .eq("user_id", user.id)
      .maybeSingle();
    data = fallback.data;
    configError = fallback.error;
  }
  if (configError) return { ok: false, erro: configError.message };
  const chatId = (data?.telegram_chat_id as string)?.trim();
  const tokenDigitado = botToken?.trim() || (data?.telegram_bot_token as string)?.trim() || "";
  if (!chatId) throw new Error("Configure seu chat id do Telegram primeiro.");
  if (!tokenDigitado && !process.env.TELEGRAM_BOT_TOKEN) return { ok: false, erro: "Configure o token do bot do Telegram primeiro." };

  const resultado = await enviarTelegram(
    chatId,
    "✅ <b>Vital.IA — Alertas</b>\nNotificações configuradas! Você vai receber novas oportunidades de licitação por aqui. 🚀",
    tokenDigitado,
  );
  if (!resultado.ok) return { ok: false, erro: resultado.erro ?? "Não foi possível enviar. Verifique o token do bot e se você já iniciou conversa com ele." };
  return { ok: true };
}

export async function salvarChatTelegram(chatId: string, botToken?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const valor = chatId.trim();
  const token = botToken?.trim() ?? "";
  if (!/^-?\d+$/.test(valor)) {
    return { ok: false, erro: "O chat id do Telegram deve ser numérico. Ex.: 5989023725." };
  }
  if (token && !/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return { ok: false, erro: "O token do bot parece inválido. Ele deve ter o formato 123456:ABC..." };
  }
  const valores: { user_id: string; telegram_chat_id: string; telegram_bot_token?: string; updated_at: string } = {
    user_id: user.id,
    telegram_chat_id: valor,
    updated_at: new Date().toISOString(),
  };
  if (token) valores.telegram_bot_token = token;
  const { error } = await supabase
    .from("notificacoes_config")
    .upsert(valores, { onConflict: "user_id" });
  if (erroColunaTelegramToken(error)) {
    const { error: chatError } = await supabase
      .from("notificacoes_config")
      .upsert({ user_id: user.id, telegram_chat_id: valor, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (chatError) return { ok: false, erro: chatError.message };
    revalidatePath("/vital-norte/alertas");
    return {
      ok: true,
      tokenSalvo: false,
      aviso: "Chat id salvo. O token será usado para teste agora, mas só ficará salvo depois que a migration do banco for aplicada.",
    };
  }
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/vital-norte/alertas");
  return { ok: true, tokenSalvo: true };
}
