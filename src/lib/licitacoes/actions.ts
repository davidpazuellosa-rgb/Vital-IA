"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UnifiedLicitacao, type EtapaSlug } from "./types";

export async function salvarLicitacao(licitacao: UnifiedLicitacao) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase.from("saved_licitacoes").insert({
    user_id: user.id,
    numero_controle_pncp: licitacao.numeroControlePNCP,
    plataforma: licitacao.plataforma,
    titulo: licitacao.titulo,
    descricao: licitacao.descricao,
    orgao: licitacao.orgao,
    uf: licitacao.uf,
    municipio: licitacao.municipio,
    modalidade: licitacao.modalidade,
    situacao: licitacao.situacao,
    valor_estimado: licitacao.valorEstimado,
    data_publicacao: licitacao.dataPublicacao,
    data_abertura_proposta: licitacao.dataAberturaProposta,
    data_encerramento_proposta: licitacao.dataEncerramentoProposta,
    link_origem: licitacao.linkOrigem,
  });

  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath("/minhas-licitacoes");
}

export async function removerLicitacaoSalva(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase.from("saved_licitacoes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minhas-licitacoes");
}

export async function atualizarEtapaLicitacao(id: string, etapa: EtapaSlug) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("saved_licitacoes")
    .update({ etapa })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minhas-licitacoes");
}
