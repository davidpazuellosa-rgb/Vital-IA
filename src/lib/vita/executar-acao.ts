import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { UnifiedLicitacao } from "@/lib/licitacoes/types";

/** Executa uma ação JÁ APROVADA pelo usuário, com a sessão dele. Devolve um texto de resultado. */
export async function executarAcaoAprovada(
  supabase: SupabaseClient,
  userId: string,
  tipo: string,
  parametros: Record<string, unknown>,
): Promise<string> {
  switch (tipo) {
    case "salvar_licitacao": {
      const l = parametros.licitacao as UnifiedLicitacao | undefined;
      if (!l?.numeroControlePNCP) throw new Error("Dados da licitação ausentes.");
      const { error } = await supabase.from("saved_licitacoes").insert({
        user_id: userId,
        numero_controle_pncp: l.numeroControlePNCP,
        plataforma: l.plataforma,
        titulo: l.titulo,
        descricao: l.descricao,
        orgao: l.orgao,
        uf: l.uf,
        municipio: l.municipio,
        modalidade: l.modalidade,
        situacao: l.situacao,
        valor_estimado: l.valorEstimado,
        data_publicacao: l.dataPublicacao,
        data_abertura_proposta: l.dataAberturaProposta,
        data_encerramento_proposta: l.dataEncerramentoProposta,
        link_origem: l.linkOrigem,
      });
      if (error && error.code !== "23505") throw new Error(error.message);
      revalidatePath("/minhas-licitacoes");
      return error ? "A licitação já estava salva." : `Licitação ${l.numeroControlePNCP} salva em Minhas Licitações.`;
    }
    case "remover_licitacao_salva": {
      const ids = (parametros.ids as string[] | undefined) ?? [];
      if (!ids.length) throw new Error("Nada para remover.");
      const { data: propostas } = await supabase.from("propostas").select("status").in("licitacao_id", ids);
      if ((propostas ?? []).some((p) => p.status === "enviada")) {
        throw new Error("A proposta desta licitação foi enviada depois do pedido; remoção cancelada por segurança.");
      }
      const { error, count } = await supabase
        .from("saved_licitacoes")
        .delete({ count: "exact" })
        .in("id", ids)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      revalidatePath("/minhas-licitacoes");
      return count ? `Licitação ${String(parametros.numero)} removida de Minhas Licitações.` : "A licitação já não estava salva.";
    }
    default:
      throw new Error(`Ação desconhecida: ${tipo}`);
  }
}
