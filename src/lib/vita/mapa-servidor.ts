import type { SupabaseClient } from "@supabase/supabase-js";
import { MAPA, type EntradaMapa, type FonteMapa } from "./mapa";

/* Mapa EFETIVO da empresa: o padrão do código (menos o que foi desligado) + os assuntos próprios
 * criados na página Vita. É este que a Vita usa para procurar informações. */

export type MapaPersonalizado = {
  id: string; area: string; assunto: string; palavras: string[]; fontes: FonteMapa[]; dica: string | null; ativo: boolean;
};

export async function carregarMapaPersonalizado(supabase: SupabaseClient): Promise<MapaPersonalizado[]> {
  const { data } = await supabase.from("vita_mapa").select("id, area, assunto, palavras, fontes, dica, ativo").order("created_at");
  return (data ?? []).map((r) => ({
    id: String(r.id), area: String(r.area), assunto: String(r.assunto),
    palavras: Array.isArray(r.palavras) ? (r.palavras as string[]) : [],
    fontes: Array.isArray(r.fontes) ? (r.fontes as FonteMapa[]) : [],
    dica: (r.dica as string | null) ?? null, ativo: r.ativo !== false,
  }));
}

export function montarMapa(desativados: string[], personalizadas: MapaPersonalizado[]): EntradaMapa[] {
  const base = MAPA.filter((e) => !desativados.includes(e.id)).map((e) => ({ ...e, origem: "padrao" as const }));
  const extras = personalizadas.filter((p) => p.ativo && p.fontes.length).map((p): EntradaMapa => ({
    id: `p_${p.id}`, idBanco: p.id, origem: "personalizado", area: p.area, assunto: p.assunto, palavras: p.palavras, fontes: p.fontes,
    ...(p.dica ? { dica: p.dica } : {}),
  }));
  return [...base, ...extras];
}

/** Mapa que a Vita usa agora. */
export async function carregarMapa(supabase: SupabaseClient, desativados?: string[]): Promise<EntradaMapa[]> {
  let off = desativados;
  if (!off) {
    const { data } = await supabase.from("vita_configuracao").select("mapa_desativados").limit(1).maybeSingle();
    off = Array.isArray(data?.mapa_desativados) ? (data!.mapa_desativados as string[]) : [];
  }
  return montarMapa(off, await carregarMapaPersonalizado(supabase));
}
