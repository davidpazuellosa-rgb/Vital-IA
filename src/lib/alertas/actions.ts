"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { carregarEmailConfigStorage, salvarEmailConfigStorage } from "@/lib/notificacoes/email-config";
import { enviarEmail } from "@/lib/notificacoes/email";
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

function erroColunasEmail(error: { code?: string; message: string } | null): boolean {
  return Boolean(
    (error?.message.includes("email_destino") ||
      error?.message.includes("email_remetente") ||
      error?.message.includes("email_api_key")) &&
      (error.code === "PGRST204" || error.message.includes("does not exist")),
  );
}

function erroPersistenciaEmail(error: { code?: string; message: string } | null): boolean {
  return Boolean(erroColunasEmail(error) || error?.message.includes("row-level security"));
}

function remetentePadraoEmail(): string {
  return process.env.EMAIL_FROM?.trim() || "Vital Norte <onboarding@resend.dev>";
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseEmails(valor: string): string[] {
  return valor
    .split(/[,\n;]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function normalizarEmails(valor: string): string {
  return Array.from(new Set(parseEmails(valor))).join(", ");
}

function validarListaEmails(valor: string): string | null {
  const emails = parseEmails(valor);
  if (emails.length === 0) return "Cadastre pelo menos um e-mail.";
  const invalido = emails.find((email) => !emailValido(email));
  if (invalido) return `E-mail inválido: ${invalido}`;
  return null;
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

export async function enviarTesteEmailAlertas(apiKey?: string, emailDestino?: string, emailRemetente?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: configEmail, error } = await supabase
    .from("notificacoes_config")
    .select("email_destino, email_remetente, email_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  let data: { email_destino?: string | null; email_remetente?: string | null; email_api_key?: string | null } | null =
    configEmail;
  if (erroColunasEmail(error)) {
    data = await carregarEmailConfigStorage(createServiceClient(), user.id);
  } else if (error) {
    return { ok: false, erro: error.message };
  }
  const emailStorage = await carregarEmailConfigStorage(createServiceClient(), user.id);
  data = { ...data, ...emailStorage };

  const destino = normalizarEmails(emailDestino?.trim() || String(data?.email_destino ?? ""));
  const remetente = String(emailRemetente?.trim() || remetentePadraoEmail() || data?.email_remetente).trim();
  const chave = apiKey?.trim() || String(data?.email_api_key ?? "").trim();

  const erroEmails = validarListaEmails(destino);
  if (erroEmails) return { ok: false, erro: erroEmails };
  if (!remetente) return { ok: false, erro: "Configure o remetente primeiro. Ex.: Vital.IA <alertas@seudominio.com>" };
  if (!chave && !process.env.RESEND_API_KEY) return { ok: false, erro: "Configure a API key do Resend primeiro." };

  const resultado = await enviarEmail({
    para: destino,
    remetente,
    apiKey: chave,
    assunto: "✅ Vital.IA — Alertas por e-mail configurados",
    texto: "Notificações por e-mail configuradas. Você vai receber novas oportunidades de licitação por aqui.",
    html:
      "<h2>✅ Vital.IA — Alertas</h2><p>Notificações por e-mail configuradas.</p><p>Você vai receber novas oportunidades de licitação por aqui. 🚀</p>",
  });

  if (!resultado.ok) return { ok: false, erro: resultado.erro ?? "Não foi possível enviar o e-mail de teste." };
  return { ok: true };
}

export async function salvarEmailAlertas(emailDestino: string, emailRemetente: string, apiKey?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const destino = normalizarEmails(emailDestino);
  const remetente = emailRemetente.trim() || remetentePadraoEmail();
  const chave = apiKey?.trim() ?? "";

  const erroEmails = validarListaEmails(destino);
  if (erroEmails) return { ok: false, erro: erroEmails };
  if (!remetente) return { ok: false, erro: "Informe o remetente. Ex.: Vital.IA <alertas@seudominio.com>" };

  const valores: {
    user_id: string;
    email_destino: string;
    email_remetente: string;
    email_api_key?: string;
    updated_at: string;
  } = {
    user_id: user.id,
    email_destino: destino,
    email_remetente: remetente,
    updated_at: new Date().toISOString(),
  };
  if (chave) valores.email_api_key = chave;

  const persistencia = createServiceClient();
  const { error } = await persistencia.from("notificacoes_config").upsert(valores, { onConflict: "user_id" });

  if (erroPersistenciaEmail(error)) {
    const atual = await carregarEmailConfigStorage(createServiceClient(), user.id);
    const salvoStorage = await salvarEmailConfigStorage(persistencia, user.id, {
      email_destino: destino,
      email_remetente: remetente,
      email_api_key: chave || String(atual.email_api_key ?? ""),
    });
    if (!salvoStorage.ok) return { ok: false, erro: salvoStorage.erro };
    revalidatePath("/vital-norte/alertas");
    return { ok: true, apiKeySalva: true, aviso: "Configuração salva no storage privado do Supabase." };
  }
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/vital-norte/alertas");
  return { ok: true, apiKeySalva: true };
}

export async function salvarEmailsCadastrados(emailDestino: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const destino = normalizarEmails(emailDestino);
  const erroEmails = validarListaEmails(destino);
  if (erroEmails) return { ok: false, erro: erroEmails };

  const { data: configAtual, error: configError } = await supabase
    .from("notificacoes_config")
    .select("email_remetente, email_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  let remetente = String(configAtual?.email_remetente ?? "").trim();
  let apiKey = String(configAtual?.email_api_key ?? "").trim();
  if (erroPersistenciaEmail(configError)) {
  const storage = await carregarEmailConfigStorage(createServiceClient(), user.id);
    remetente = String(storage.email_remetente ?? "").trim();
    apiKey = String(storage.email_api_key ?? "").trim();
  } else if (configError) {
    return { ok: false, erro: configError.message };
  }

  const persistencia = createServiceClient();
  const { error } = await persistencia.from("notificacoes_config").upsert(
    {
      user_id: user.id,
      email_destino: destino,
      email_remetente: remetente,
      ...(apiKey ? { email_api_key: apiKey } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (erroPersistenciaEmail(error)) {
    const salvoStorage = await salvarEmailConfigStorage(persistencia, user.id, {
      email_destino: destino,
      email_remetente: remetente,
      email_api_key: apiKey,
    });
    if (!salvoStorage.ok) return { ok: false, erro: salvoStorage.erro };
    revalidatePath("/vital-norte/alertas");
    return { ok: true };
  }
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/vital-norte/alertas");
  return { ok: true };
}
