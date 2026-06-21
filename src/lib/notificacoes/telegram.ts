export type ResultadoTelegram = {
  ok: boolean;
  erro?: string;
};

/** Envia uma mensagem via Telegram Bot API. */
export async function enviarTelegram(chatId: string, texto: string): Promise<ResultadoTelegram> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, erro: "TELEGRAM_BOT_TOKEN não configurado no ambiente." };
  if (!chatId) return { ok: false, erro: "Chat id do Telegram não configurado." };
  try {
    const r = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) return { ok: true };
    const corpo = await r.json().catch(() => null) as { description?: string } | null;
    return { ok: false, erro: corpo?.description ?? "Telegram retornou HTTP " + r.status + "." };
  } catch {
    return { ok: false, erro: "Não foi possível conectar ao Telegram." };
  }
}
