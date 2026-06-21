import { NextResponse } from "next/server";
import type { EmpresaDados } from "@/lib/empresa/actions";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { gerarPdfDeclaracoes } from "@/lib/propostas/gerar-pdf";
import type { AnaliseEdital } from "@/lib/propostas/types";
import { CONFIGURACAO_PROPOSTA_PADRAO, type PropostaConfiguracao } from "@/lib/propostas/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
    const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

    const [{ data: licitacao }, { data: proposta }, { data: empresa }, { data: configuracao }] = await Promise.all([
      supabase.from("saved_licitacoes").select("*").eq("id", id).eq("user_id", user.id).single(),
      supabase.from("propostas").select("*").eq("licitacao_id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("empresa").select("*").eq("user_id", empresaUserId).maybeSingle(),
      supabase.from("proposta_configuracao").select("*").eq("user_id", empresaUserId).maybeSingle(),
    ]);

    if (!licitacao) return NextResponse.json({ erro: "Licitação não encontrada." }, { status: 404 });
    const analise = proposta?.analise_edital as AnaliseEdital | null;
    if (!analise) return NextResponse.json({ erro: "Analise o edital antes de gerar as declarações." }, { status: 409 });

    const bytes = await gerarPdfDeclaracoes({
      empresa: normalizarEmpresa(empresa),
      configuracao: { ...CONFIGURACAO_PROPOSTA_PADRAO, ...(configuracao ?? {}) } as PropostaConfiguracao,
      licitacao,
      analise,
    });

    const nome = "Declaracoes_" + arquivoSeguro(licitacao.numero_controle_pncp || id) + ".pdf";
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"" + nome + "\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Não foi possível gerar as declarações.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}

function normalizarEmpresa(valor: Partial<EmpresaDados> | null): EmpresaDados {
  const campos: Array<keyof EmpresaDados> = [
    "razao_social", "nome_fantasia", "cnpj", "porte", "natureza_juridica", "cnae_principal",
    "inscricao_estadual", "inscricao_municipal", "email", "telefone", "cep", "logradouro",
    "numero", "complemento", "bairro", "municipio", "uf", "dados_bancarios",
  ];
  const empresa = { data_abertura: valor?.data_abertura ?? null } as EmpresaDados;
  for (const campo of campos) empresa[campo] = String(valor?.[campo] ?? "") as never;
  return empresa;
}

function arquivoSeguro(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "licitacao";
}
