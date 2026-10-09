"use server";

import { revalidatePath } from "next/cache";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { createClient } from "@/lib/supabase/server";
import { resumirTexto } from "./feedback";

/** Avalia (👍 = 1, 👎 = -1) ou remove a avaliação (0) de uma resposta da Vita. */
export async function avaliarResposta(mensagemId: string, nota: 1 | -1 | 0, motivo?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  if (nota === 0) {
    const { error } = await supabase.from("vita_feedback").delete().eq("mensagem_id", mensagemId).eq("autor_id", user.id);
    if (error) throw new Error(error.message);
    revalidatePath("/vita");
    return;
  }

  // A resposta (do próprio usuário, via RLS) e o pedido que a antecedeu.
  const { data: resposta } = await supabase.from("vita_mensagens").select("id, conversa_id, conteudo, created_at").eq("id", mensagemId).eq("papel", "assistant").maybeSingle();
  if (!resposta) throw new Error("Resposta não encontrada.");
  const { data: pedido } = await supabase
    .from("vita_mensagens")
    .select("conteudo")
    .eq("conversa_id", resposta.conversa_id)
    .eq("papel", "user")
    .lt("created_at", resposta.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const empresa = await resolverEmpresaUserId(supabase, user.id);
  const { error } = await supabase.from("vita_feedback").upsert(
    {
      user_id: empresa,
      autor_id: user.id,
      mensagem_id: mensagemId,
      conversa_id: resposta.conversa_id,
      nota,
      motivo: motivo ? resumirTexto(motivo, 200) : null,
      pedido: resumirTexto(String(pedido?.conteudo ?? ""), 300),
      resposta: resumirTexto(String(resposta.conteudo ?? ""), 400),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mensagem_id,autor_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/vita");
}

export async function removerAvaliacao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("vita_feedback").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vita");
}
