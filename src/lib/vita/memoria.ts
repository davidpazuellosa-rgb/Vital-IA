import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { FERRAMENTAS_DE_MEMORIA, IDS_CATEGORIA, type CategoriaMemoria } from "./catalogo-ferramentas";

/* ---------------------------------------------------------------------------------------------
 * Memória geral da Vita (escopo da empresa) e configuração de ferramentas.
 *  - A memória entra nas instruções de cada conversa (só as ATIVAS, as mais recentes primeiro).
 *  - A Vita só grava o que o USUÁRIO afirmou; nunca texto de documentos/editais/buscas.
 *  - Tudo é visível e editável em /vita.
 * ------------------------------------------------------------------------------------------- */

export type Memoria = {
  id: string;
  conteudo: string;
  categoria: CategoriaMemoria;
  origem: "vita" | "usuario";
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type ConfigVita = { memoriaAtiva: boolean; memoriaAutomatica: boolean; desativadas: string[] };

export const MAX_MEMORIAS = 200;
const MAX_CHARS_PROMPT = 6_000;
const MAX_CONTEUDO = 600;

export const CONFIG_PADRAO: ConfigVita = { memoriaAtiva: true, memoriaAutomatica: true, desativadas: [] };

export async function carregarConfig(supabase: SupabaseClient): Promise<ConfigVita> {
  const { data } = await supabase.from("vita_configuracao").select("memoria_ativa, memoria_automatica, ferramentas_desativadas").limit(1).maybeSingle();
  if (!data) return CONFIG_PADRAO;
  return {
    memoriaAtiva: data.memoria_ativa !== false,
    memoriaAutomatica: data.memoria_automatica !== false,
    desativadas: Array.isArray(data.ferramentas_desativadas) ? (data.ferramentas_desativadas as string[]) : [],
  };
}

export async function carregarMemoriasAtivas(supabase: SupabaseClient): Promise<Memoria[]> {
  const { data } = await supabase
    .from("vita_memorias")
    .select("id, conteudo, categoria, origem, ativo, created_at, updated_at")
    .eq("ativo", true)
    .order("created_at", { ascending: false })
    .limit(80);
  return (data ?? []) as Memoria[];
}

const ROTULO_CAT: Record<string, string> = { geral: "Geral", empresa: "Empresa", preferencia: "Preferência", processo: "Processo", clientes: "Clientes", regra: "Regra" };
export const idCurto = (id: string) => id.slice(0, 8);

/** Bloco que vai nas instruções da Vita com as memórias ativas (limitado em tamanho). */
export function blocoDeMemoria(memorias: Memoria[]): string {
  if (!memorias.length) return "";
  const linhas: string[] = [];
  let total = 0;
  for (const m of memorias) {
    const l = `- [${idCurto(m.id)}] (${ROTULO_CAT[m.categoria] ?? "Geral"}) ${m.conteudo.replace(/\s+/g, " ").trim()}`;
    if (total + l.length > MAX_CHARS_PROMPT) break;
    linhas.push(l);
    total += l.length;
  }
  return linhas.join("\n");
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Tenta evitar segredos: a Vita não deve guardar senhas, chaves ou números de documentos pessoais. */
const PARECE_SEGREDO = /(senha|password|token|api[\s_-]?key|chave\s+(de\s+)?(api|acesso|secreta)|secret)\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\bsk[-_][a-z0-9]{16,}|\beyJ[a-zA-Z0-9_-]{20,}/i;

type Ctx = { supabase: SupabaseClient; userId: string };
const json = (v: unknown) => JSON.stringify(v);

export async function memorizar(args: Record<string, unknown>, ctx: Ctx, conversaId?: string | null): Promise<string> {
  const conteudo = String(args.conteudo ?? "").replace(/\s+/g, " ").trim();
  if (conteudo.length < 3) return json({ erro: "Escreva a memória em uma frase clara." });
  if (conteudo.length > MAX_CONTEUDO) return json({ erro: `Memória longa demais (máx. ${MAX_CONTEUDO} caracteres). Resuma em uma ideia só.` });
  if (PARECE_SEGREDO.test(conteudo)) return json({ erro: "Isso parece conter senha, chave ou documento pessoal. Não guardo esse tipo de dado na memória." });
  const categoria = IDS_CATEGORIA.includes(String(args.categoria)) ? String(args.categoria) : "geral";

  const empresa = await resolverEmpresaUserId(ctx.supabase, ctx.userId);
  const { data: existentes } = await ctx.supabase.from("vita_memorias").select("id, conteudo").eq("user_id", empresa).limit(MAX_MEMORIAS + 1);
  if ((existentes?.length ?? 0) >= MAX_MEMORIAS) return json({ erro: `Limite de ${MAX_MEMORIAS} memórias atingido. Peça ao usuário para apagar algumas na página Vita.` });
  const novo = normalizar(conteudo);
  const repetida = (existentes ?? []).find((m) => {
    const x = normalizar(String(m.conteudo));
    return x === novo || x.includes(novo) || novo.includes(x);
  });
  if (repetida) return json({ resultado: "Já existe uma memória igual ou parecida; nada foi duplicado.", id: idCurto(String(repetida.id)) });

  const { data, error } = await ctx.supabase
    .from("vita_memorias")
    .insert({ user_id: empresa, conteudo, categoria, origem: "vita", conversa_id: conversaId ?? null })
    .select("id")
    .single();
  if (error) return json({ erro: error.message });
  return json({ resultado: `Memorizado. O usuário pode ver, editar ou apagar em "Vita" no menu.`, id: idCurto(String(data.id)) });
}

export async function esquecer(args: Record<string, unknown>, ctx: Ctx): Promise<string> {
  const alvo = String(args.id ?? "").replace(/[\[\]\s]/g, "").toLowerCase();
  if (alvo.length < 6) return json({ erro: "Informe o id da memória (o código entre colchetes)." });
  const empresa = await resolverEmpresaUserId(ctx.supabase, ctx.userId);
  const { data: todas } = await ctx.supabase.from("vita_memorias").select("id, conteudo").eq("user_id", empresa);
  const achadas = (todas ?? []).filter((m) => String(m.id).toLowerCase().startsWith(alvo));
  if (achadas.length !== 1) return json({ erro: achadas.length ? "Id ambíguo." : "Não encontrei essa memória." });
  const { error } = await ctx.supabase.from("vita_memorias").delete().eq("id", achadas[0].id);
  if (error) return json({ erro: error.message });
  return json({ resultado: `Esquecido: "${String(achadas[0].conteudo).slice(0, 120)}"` });
}

export const ehFerramentaDeMemoria = (nome: string) => FERRAMENTAS_DE_MEMORIA.includes(nome);
