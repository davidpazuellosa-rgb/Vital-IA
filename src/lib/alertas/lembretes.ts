import { formatarData } from "@/lib/format";
import { carregarEmailConfigStorage } from "@/lib/notificacoes/email-config";
import { enviarEmail } from "@/lib/notificacoes/email";
import { enviarTelegram } from "@/lib/notificacoes/telegram";
import { createServiceClient } from "@/lib/supabase/service";

/** Avisa quando falta pouco para encerrar o prazo de uma proposta que ainda não foi enviada. */
const LIMITES_HORAS = [24, 3]; // do mais distante para o mais próximo

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Pendente = {
  id: string;
  user_id: string;
  titulo: string;
  orgao: string;
  uf: string;
  data_encerramento_proposta: string;
  restanteHoras: number;
  limite: number; // o menor limite já atingido
};

export type ResumoLembretes = { verificadas: number; avisadas: number; usuarios: number };

export async function executarLembretes(): Promise<ResumoLembretes> {
  const supabase = createServiceClient();
  const agora = Date.now();
  const maximo = Math.max(...LIMITES_HORAS);

  // Licitações em andamento (proposta pronta, ou oportunidade com rascunho) que encerram dentro do maior limite.
  const { data: candidatas, error } = await supabase
    .from("saved_licitacoes")
    .select("id, user_id, titulo, orgao, uf, etapa, data_encerramento_proposta")
    .in("etapa", ["oportunidade", "proposta_pronta"])
    .gt("data_encerramento_proposta", new Date(agora).toISOString())
    .lte("data_encerramento_proposta", new Date(agora + maximo * 3_600_000).toISOString());
  if (error) throw new Error(`Falha ao buscar licitações: ${error.message}`);
  if (!candidatas?.length) return { verificadas: 0, avisadas: 0, usuarios: 0 };

  const ids = candidatas.map((c) => c.id as string);
  const [{ data: propostas }, { data: ja }] = await Promise.all([
    supabase.from("propostas").select("licitacao_id, status").in("licitacao_id", ids),
    supabase.from("lembretes_proposta").select("licitacao_id, limite_horas").in("licitacao_id", ids),
  ]);
  const enviadas = new Set((propostas ?? []).filter((p) => p.status === "enviada").map((p) => String(p.licitacao_id)));
  const comRascunho = new Set((propostas ?? []).map((p) => String(p.licitacao_id)));
  const jaAvisado = new Set((ja ?? []).map((r) => `${r.licitacao_id}:${r.limite_horas}`));

  const pendentes: Pendente[] = [];
  for (const c of candidatas) {
    const id = String(c.id);
    if (enviadas.has(id)) continue;
    if (c.etapa === "oportunidade" && !comRascunho.has(id)) continue; // só salvou, não começou proposta
    const restanteHoras = (new Date(String(c.data_encerramento_proposta)).getTime() - agora) / 3_600_000;
    const atingidos = LIMITES_HORAS.filter((l) => restanteHoras <= l);
    if (atingidos.length === 0) continue;
    const limite = Math.min(...atingidos);
    if (jaAvisado.has(`${id}:${limite}`)) continue;
    pendentes.push({
      id, user_id: String(c.user_id), titulo: String(c.titulo ?? ""), orgao: String(c.orgao ?? ""), uf: String(c.uf ?? ""),
      data_encerramento_proposta: String(c.data_encerramento_proposta), restanteHoras, limite,
    });
  }
  if (pendentes.length === 0) return { verificadas: candidatas.length, avisadas: 0, usuarios: 0 };

  const porUsuario = new Map<string, Pendente[]>();
  for (const p of pendentes) porUsuario.set(p.user_id, [...(porUsuario.get(p.user_id) ?? []), p]);

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  const link = site ? `${site}/minhas-licitacoes` : "";
  let avisadas = 0;

  for (const [userId, lista] of porUsuario) {
    lista.sort((a, b) => a.restanteHoras - b.restanteHoras);
    const { data: cfg } = await supabase
      .from("notificacoes_config")
      .select("telegram_chat_id, telegram_bot_token, email_destino, email_remetente, email_api_key")
      .eq("user_id", userId)
      .maybeSingle();
    const emailStorage = await carregarEmailConfigStorage(supabase, userId);
    const config = { ...(cfg ?? {}), ...emailStorage } as Record<string, string | null | undefined>;

    const linhas = lista.map((p) => {
      const quando = p.restanteHoras < 1 ? "menos de 1h" : `~${Math.round(p.restanteHoras)}h`;
      return { texto: `${p.orgao} (${p.uf}) — encerra em ${quando} (${formatarData(p.data_encerramento_proposta)})`, titulo: p.titulo };
    });
    const textoTelegram =
      `⏰ <b>Proposta${lista.length > 1 ? "s" : ""} sem envio registrado</b>\n\n` +
      linhas.map((l) => `• <b>${escapeHtml(l.texto)}</b>\n  ${escapeHtml(l.titulo.slice(0, 110))}`).join("\n\n") +
      (link ? `\n\n${link}` : "");

    let algumCanal = false;
    const chatId = config.telegram_chat_id?.trim();
    if (chatId) {
      const r = await enviarTelegram(chatId, textoTelegram, config.telegram_bot_token ?? undefined);
      if (r.ok) algumCanal = true;
      else console.error("[Lembretes] Falha Telegram", { userId, erro: r.erro });
    }
    const emailDestino = config.email_destino?.trim();
    const apiKey = config.email_api_key?.trim() || process.env.RESEND_API_KEY?.trim();
    const remetente = process.env.EMAIL_FROM?.trim() || config.email_remetente?.trim() || "Vital Norte <onboarding@resend.dev>";
    if (emailDestino && apiKey) {
      const r = await enviarEmail({
        para: emailDestino, remetente, apiKey,
        assunto: `⏰ ${lista.length} proposta(s) a encerrar sem envio registrado`,
        texto: textoTelegram.replace(/<[^>]*>/g, ""),
        html: `<p><strong>Proposta(s) sem envio registrado:</strong></p><ul>${linhas.map((l) => `<li><strong>${escapeHtml(l.texto)}</strong><br>${escapeHtml(l.titulo.slice(0, 160))}</li>`).join("")}</ul>${link ? `<p><a href="${escapeHtml(link)}">Abrir Minhas Licitações</a></p>` : ""}`,
      });
      if (r.ok) algumCanal = true;
      else console.error("[Lembretes] Falha E-mail", { userId, erro: r.erro });
    }
    if (!algumCanal) {
      console.error("[Lembretes] Nenhum canal de notificação configurado ou enviado", { userId });
      continue; // não marca como avisado: tenta de novo na próxima rodada
    }

    // Marca todos os limites já atingidos, para não mandar o de 24h depois do de 3h.
    const marcas = lista.flatMap((p) => LIMITES_HORAS.filter((l) => p.restanteHoras <= l).map((l) => ({ licitacao_id: p.id, limite_horas: l })));
    await supabase.from("lembretes_proposta").upsert(marcas, { onConflict: "licitacao_id,limite_horas", ignoreDuplicates: true });
    avisadas += lista.length;
  }
  return { verificadas: candidatas.length, avisadas, usuarios: porUsuario.size };
}
