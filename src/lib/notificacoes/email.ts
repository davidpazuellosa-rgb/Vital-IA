export type ResultadoEmail = {
  ok: boolean;
  erro?: string;
};

export type EmailPayload = {
  para: string;
  assunto: string;
  html: string;
  texto?: string;
  remetente?: string;
  apiKey?: string;
};

/** Envia e-mail via Resend. A chave pode vir do Vercel (RESEND_API_KEY) ou da configuração salva. */
export async function enviarEmail(payload: EmailPayload): Promise<ResultadoEmail> {
  const apiKey = process.env.RESEND_API_KEY?.trim() || payload.apiKey?.trim();
  const remetente = payload.remetente?.trim() || process.env.EMAIL_FROM?.trim();

  if (!apiKey) return { ok: false, erro: "RESEND_API_KEY não configurada." };
  if (!remetente) return { ok: false, erro: "Remetente de e-mail não configurado." };
  if (!payload.para?.trim()) return { ok: false, erro: "E-mail de destino não configurado." };

  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente,
        to: [payload.para.trim()],
        subject: payload.assunto,
        html: payload.html,
        text: payload.texto,
      }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => null);
      const mensagem = typeof corpo?.message === "string" ? corpo.message : "Falha ao enviar e-mail.";
      return { ok: false, erro: mensagem };
    }

    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível conectar ao serviço de e-mail." };
  }
}
