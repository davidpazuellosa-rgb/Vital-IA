import { createServiceClient } from "@/lib/supabase/service";
import { buscarLicitacoes } from "@/lib/licitacoes/registry";
import { linkPncp } from "@/lib/licitacoes/pncp-url";
import { formatarData, formatarMoeda } from "@/lib/format";
import { enviarTelegram } from "@/lib/notificacoes/telegram";
import type { UniversalFilter } from "@/lib/licitacoes/types";

function ymd(diasAtras: number): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().slice(0, 10);
}

type AlertaRow = {
  id: string;
  user_id: string;
  nome: string;
  keyword: string;
  ufs: string[];
  modalidades: number[];
  valor_min: number | null;
  valor_max: number | null;
  apenas_aberto: boolean;
};

export type ResumoExecucao = {
  alertas: number;
  novas: number;
  enviados: number;
};

/** Executa todos os alertas ativos: busca, deduplica e notifica no Telegram. */
export async function executarAlertas(): Promise<ResumoExecucao> {
  const supabase = createServiceClient();
  const { data: alertasData } = await supabase.from("alertas").select("*").eq("ativo", true);
  const alertas = (alertasData ?? []) as AlertaRow[];

  let totalNovas = 0;
  let totalEnviados = 0;

  for (const a of alertas) {
    const filtro: UniversalFilter = {
      keyword: a.keyword || undefined,
      ufs: a.ufs?.length ? a.ufs : undefined,
      modalidades: a.modalidades?.length ? a.modalidades : undefined,
      dataInicial: ymd(30),
      dataFinal: ymd(0),
      valorMin: a.valor_min ?? undefined,
      valorMax: a.valor_max ?? undefined,
      plataformas: ["pncp"],
      apenasAberto: a.apenas_aberto,
    };

    let itens: Awaited<ReturnType<typeof buscarLicitacoes>>["itens"] = [];
    try {
      itens = (await buscarLicitacoes(filtro, { pagina: 1, tamanhoPagina: 30 })).itens;
    } catch {
      continue;
    }

    // Deduplica contra o que já foi enviado para este alerta
    const { data: jaEnviados } = await supabase
      .from("alerta_envios")
      .select("numero_controle_pncp")
      .eq("alerta_id", a.id);
    const vistos = new Set((jaEnviados ?? []).map((r) => r.numero_controle_pncp));
    const novas = itens.filter((i) => !vistos.has(i.numeroControlePNCP));

    await supabase.from("alertas").update({ ultima_execucao: new Date().toISOString() }).eq("id", a.id);
    if (novas.length === 0) continue;
    totalNovas += novas.length;

    // Chat do usuário
    let { data: config, error: configError }: {
      data: { telegram_chat_id?: string | null; telegram_bot_token?: string | null } | null;
      error: { code?: string; message: string } | null;
    } = await supabase
      .from("notificacoes_config")
      .select("telegram_chat_id, telegram_bot_token")
      .eq("user_id", a.user_id)
      .maybeSingle();
    if (configError?.code === "PGRST204" && configError.message.includes("telegram_bot_token")) {
      const fallback = await supabase
        .from("notificacoes_config")
        .select("telegram_chat_id")
        .eq("user_id", a.user_id)
        .maybeSingle();
      config = fallback.data;
      configError = fallback.error;
    }
    if (configError) {
      console.error("[Alertas] Falha ao carregar configuração de notificação", {
        alertaId: a.id,
        userId: a.user_id,
        erro: configError.message,
      });
      continue;
    }
    const chatId = config?.telegram_chat_id;
    const botToken = config?.telegram_bot_token;
    if (!chatId) {
      console.error("[Alertas] Chat id do Telegram não configurado", {
        alertaId: a.id,
        userId: a.user_id,
      });
      continue;
    }

    const linhas = novas.slice(0, 8).map((i, idx) => {
      const link = linkPncp(i.numeroControlePNCP);
      const titulo = (i.titulo || i.descricao || "Licitação").slice(0, 120);
      return (
        `${idx + 1}. <b>${escapeHtml(titulo)}</b>\n` +
        `   ${escapeHtml(i.orgao)} · ${i.uf || "—"}\n` +
        `   💰 ${formatarMoeda(i.valorEstimado)} · 📅 encerra ${formatarData(i.dataEncerramentoProposta)}` +
        (link ? `\n   ${link}` : "")
      );
    });
    const extra = novas.length > 8 ? `\n\n+${novas.length - 8} outra(s).` : "";
    const texto = `🔔 <b>${escapeHtml(a.nome)}</b> — ${novas.length} nova(s) oportunidade(s)\n\n${linhas.join("\n\n")}${extra}`;

    const resultado = await enviarTelegram(chatId, texto, botToken);
    if (!resultado.ok) {
      console.error("[Alertas] Falha Telegram", {
        alertaId: a.id,
        userId: a.user_id,
        erro: resultado.erro,
      });
      continue;
    }

    await supabase.from("alerta_envios").insert(
      novas.map((i) => ({ alerta_id: a.id, numero_controle_pncp: i.numeroControlePNCP })),
    );
    totalEnviados += novas.length;
  }

  return { alertas: alertas.length, novas: totalNovas, enviados: totalEnviados };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
