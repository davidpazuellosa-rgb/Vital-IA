"use server";

import { createClient } from "@/lib/supabase/server";

export type ResumoConversa = { id: string; titulo: string; atualizadaEm: string };
export type AcaoVita = {
  id: string;
  tipo: string;
  resumo: string;
  detalhes: Array<{ rotulo: string; valor: string }>;
  aviso: string | null;
  status: "pendente" | "executada" | "recusada" | "falhou";
  resultado: string | null;
};
export type AnexoExibido = { nome: string; tipo: string; observacao?: string | null };
export type MensagemVita = {
  id: string;
  papel: "user" | "assistant";
  conteudo: string;
  ferramentas: Array<{ nome: string; rotulo: string }>;
  acoes: string[];
  anexos: AnexoExibido[];
};

async function sessao() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return supabase;
}

const semCuringas = (s: string) => s.replace(/[%_,()\\*]/g, " ").trim();

/** Conversas do usuário, mais recentes primeiro. Com `busca`, procura no título e no texto das mensagens. */
export async function listarConversas(busca?: string): Promise<ResumoConversa[]> {
  const supabase = await sessao();
  const termo = semCuringas(busca ?? "");
  let ids: string[] | null = null;
  if (termo) {
    const [{ data: porTitulo }, { data: porTexto }] = await Promise.all([
      supabase.from("vita_conversas").select("id").ilike("titulo", `%${termo}%`).limit(50),
      supabase.from("vita_mensagens").select("conversa_id").in("papel", ["user", "assistant"]).ilike("conteudo", `%${termo}%`).limit(200),
    ]);
    ids = [...new Set([...(porTitulo ?? []).map((c) => String(c.id)), ...(porTexto ?? []).map((m) => String(m.conversa_id))])];
    if (!ids.length) return [];
  }
  let q = supabase.from("vita_conversas").select("id, titulo, updated_at").order("updated_at", { ascending: false }).limit(50);
  if (ids) q = q.in("id", ids);
  const { data } = await q;
  return (data ?? []).map((c) => ({ id: c.id, titulo: c.titulo, atualizadaEm: c.updated_at }));
}

export async function carregarConversa(id: string): Promise<{ mensagens: MensagemVita[]; acoes: Record<string, AcaoVita> }> {
  const supabase = await sessao();
  const [{ data: msgs }, { data: acoes }] = await Promise.all([
    supabase.from("vita_mensagens").select("id, papel, conteudo, dados").eq("conversa_id", id).in("papel", ["user", "assistant"]).order("created_at"),
    supabase.from("vita_acoes").select("id, tipo, resumo, detalhes, aviso, status, resultado").eq("conversa_id", id),
  ]);
  return {
    mensagens: (msgs ?? []).map((m) => {
      const dados = (m.dados ?? {}) as { ferramentas?: MensagemVita["ferramentas"]; acoes?: string[]; anexos?: AnexoExibido[] };
      return {
        id: m.id, papel: m.papel as MensagemVita["papel"], conteudo: m.conteudo,
        ferramentas: dados.ferramentas ?? [], acoes: dados.acoes ?? [],
        anexos: (dados.anexos ?? []).map((a) => ({ nome: a.nome, tipo: a.tipo, observacao: a.observacao ?? null })),
      };
    }),
    acoes: Object.fromEntries((acoes ?? []).map((a) => [a.id, a as AcaoVita])),
  };
}

/** Apaga a conversa e os arquivos anexados nela (que nunca foram para o acervo). */
export async function apagarConversa(id: string): Promise<void> {
  const supabase = await sessao();
  const { data: msgs } = await supabase.from("vita_mensagens").select("dados").eq("conversa_id", id).eq("papel", "user");
  const caminhos = (msgs ?? []).flatMap((m) => ((m.dados as { anexos?: Array<{ path?: string }> })?.anexos ?? []).map((a) => a.path ?? "")).filter(Boolean);
  if (caminhos.length) await supabase.storage.from("documentos").remove(caminhos);
  const { error } = await supabase.from("vita_conversas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
