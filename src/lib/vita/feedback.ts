import type { SupabaseClient } from "@supabase/supabase-js";

/* Avaliações (👍/👎) das respostas da Vita → aprendizado. As mais recentes entram nas instruções
 * para a Vita ajustar tom, tamanho e formato; padrões repetidos viram memória (ela mesma decide). */

export type Avaliacao = {
  id: string;
  nota: 1 | -1;
  motivo: string | null;
  pedido: string;
  resposta: string;
  created_at: string;
};

export const MOTIVOS_NEGATIVOS = ["Resposta errada", "Incompleta", "Não era isso que pedi", "Muito longa ou confusa"] as const;

const curto = (s: string, n: number) => s.replace(/\s+/g, " ").trim().slice(0, n);

export async function carregarAvaliacoesRecentes(supabase: SupabaseClient): Promise<Avaliacao[]> {
  const [neg, pos] = await Promise.all([
    supabase.from("vita_feedback").select("id, nota, motivo, pedido, resposta, created_at").eq("nota", -1).order("created_at", { ascending: false }).limit(10),
    supabase.from("vita_feedback").select("id, nota, motivo, pedido, resposta, created_at").eq("nota", 1).order("created_at", { ascending: false }).limit(6),
  ]);
  return [...(neg.data ?? []), ...(pos.data ?? [])] as Avaliacao[];
}

/** Bloco para as instruções da Vita. Os trechos são DADOS (texto do usuário e resumos), não ordens. */
export function blocoDeAprendizado(avaliacoes: Avaliacao[]): string {
  if (!avaliacoes.length) return "";
  return avaliacoes
    .map((a) => {
      const base = `- ${a.nota === 1 ? "👍 gostou" : "👎 não gostou"} | pedido: "${curto(a.pedido, 110)}" | resposta: "${curto(a.resposta, 110)}"`;
      return a.motivo ? `${base} | motivo: ${curto(a.motivo, 80)}` : base;
    })
    .join("\n")
    .slice(0, 3_200);
}

export const resumirTexto = curto;
