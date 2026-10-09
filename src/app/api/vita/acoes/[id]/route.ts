import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executarAcaoAprovada } from "@/lib/vita/executar-acao";

export const runtime = "nodejs";

/**
 * Decide uma ação proposta pela Vita.  POST { decisao: "aprovar" | "recusar" }
 * Só o dono vê a ação (RLS). A execução usa a sessão do usuário — as mesmas permissões da tela.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { decisao } = (await request.json().catch(() => ({}))) as { decisao?: string };
  if (decisao !== "aprovar" && decisao !== "recusar") return NextResponse.json({ erro: "Decisão inválida." }, { status: 400 });

  const { data: acao } = await supabase
    .from("vita_acoes")
    .select("id, conversa_id, tipo, parametros, resumo, status")
    .eq("id", id)
    .maybeSingle();
  if (!acao) return NextResponse.json({ erro: "Ação não encontrada." }, { status: 404 });
  if (acao.status !== "pendente") return NextResponse.json({ erro: "Esta ação já foi decidida.", status: acao.status }, { status: 409 });

  // Trava contra clique duplo: só segue se ainda estiver pendente no momento da atualização.
  const { data: travada } = await supabase
    .from("vita_acoes")
    .update({ status: decisao === "recusar" ? "recusada" : "executada", decidida_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente")
    .select("id")
    .maybeSingle();
  if (!travada) return NextResponse.json({ erro: "Esta ação já foi decidida." }, { status: 409 });

  let status: "executada" | "recusada" | "falhou" = decisao === "recusar" ? "recusada" : "executada";
  let resultado = decisao === "recusar" ? "Recusada pelo usuário." : "";
  if (decisao === "aprovar") {
    try {
      resultado = await executarAcaoAprovada(supabase, user.id, acao.tipo, (acao.parametros ?? {}) as Record<string, unknown>);
    } catch (e) {
      status = "falhou";
      resultado = e instanceof Error ? e.message : "Falha ao executar.";
    }
  }
  await supabase.from("vita_acoes").update({ status, resultado }).eq("id", id);

  const nota =
    status === "executada" ? `[Atualização do sistema] O usuário APROVOU "${acao.resumo}" e foi executado: ${resultado}`
    : status === "recusada" ? `[Atualização do sistema] O usuário RECUSOU "${acao.resumo}". Nada foi alterado.`
    : `[Atualização do sistema] O usuário aprovou "${acao.resumo}", mas a execução FALHOU: ${resultado}. Nada foi alterado.`;
  await supabase.from("vita_mensagens").insert({ conversa_id: acao.conversa_id, user_id: user.id, papel: "evento", conteudo: nota });

  return NextResponse.json({ status, resultado });
}
