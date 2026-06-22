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

/** Envia e-mail via Resend. A chave pode vir da configuração salva/digitada ou do Vercel (RESEND_API_KEY). */
export async function enviarEmail(payload: EmailPayload): Promise<ResultadoEmail> {
  const apiKey = payload.apiKey?.trim() || process.env.RESEND_API_KEY?.trim();
  const remetente = payload.remetente?.trim() || process.env.EMAIL_FROM?.trim();
  const destinatarios = payload.para
    .split(/[,\n;]/)
    .map((email) => email.trim())
    .filter(Boolean);

  if (!apiKey) return { ok: false, erro: "RESEND_API_KEY não configurada." };
  if (!remetente) return { ok: false, erro: "Remetente de e-mail não configurado." };
  if (destinatarios.length === 0) return { ok: false, erro: "E-mail de destino não configurado." };

  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente,
        to: destinatarios,
        subject: payload.assunto,
        html: payload.html,
        text: payload.texto,
      }),
    });

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => null);
      const mensagem = typeof corpo?.message === "string" ? corpo.message : "Falha ao enviar e-mail.";
      return { ok: false, erro: explicarErroResend(mensagem, resposta.status) };
    }

    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível conectar ao serviço de e-mail." };
  }
}

function explicarErroResend(mensagem: string, status: number): string {
  const texto = mensagem.toLowerCase();

  if (status === 401 || texto.includes("api key")) {
    return "A API key do Resend foi recusada. Gere uma nova chave com permissão de envio e salve novamente.";
  }

  if (texto.includes("domain") || texto.includes("sender") || texto.includes("from")) {
    return `${mensagem} Confira se o remetente usa um domínio verificado no Resend, ou use Vital Norte <onboarding@resend.dev> para teste.`;
  }

  return mensagem;
}
