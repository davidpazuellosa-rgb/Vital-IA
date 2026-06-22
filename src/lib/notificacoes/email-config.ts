export type EmailConfig = {
  email_destino: string;
  email_remetente: string;
  email_api_key: string;
};

const BUCKET = "documentos";

function caminho(userId: string): string {
  return `${userId}/notificacoes/email.json`;
}

export async function carregarEmailConfigStorage(
  supabase: { storage: { from: (bucket: string) => { download: (path: string) => Promise<{ data: Blob | null; error: unknown }> } } },
  userId: string,
): Promise<Partial<EmailConfig>> {
  const { data, error } = await supabase.storage.from(BUCKET).download(caminho(userId));
  if (error || !data) return {};

  try {
    return JSON.parse(await data.text()) as Partial<EmailConfig>;
  } catch {
    return {};
  }
}

export async function salvarEmailConfigStorage(
  supabase: {
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          body: Blob,
          options: { contentType: string; upsert: boolean },
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  },
  userId: string,
  config: EmailConfig,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const arquivo = new Blob([JSON.stringify(config)], { type: "application/json" });
  const { error } = await supabase.storage.from(BUCKET).upload(caminho(userId), arquivo, {
    contentType: "application/json",
    upsert: true,
  });
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
