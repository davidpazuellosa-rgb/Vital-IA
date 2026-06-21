import { NextResponse } from "next/server";
import type { Documento } from "@/lib/documentos/types";
import type { EmpresaDados } from "@/lib/empresa/actions";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { gerarPdfProposta, type AnexoPdf, type ItemPropostaPdf } from "@/lib/propostas/gerar-pdf";
import type { AnaliseEdital } from "@/lib/propostas/types";
import { CONFIGURACAO_PROPOSTA_PADRAO, type PropostaConfiguracao } from "@/lib/propostas/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
    const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

    const formData = await request.formData();
    const itens = validarItens(formData.get("itens"));
    if (itens.length === 0) return NextResponse.json({ erro: "Selecione e preencha ao menos um item." }, { status: 400 });

    const [{ data: licitacao }, { data: proposta }, { data: empresa }, { data: configuracao }, { data: documentos }] = await Promise.all([
      supabase.from("saved_licitacoes").select("*").eq("id", id).eq("user_id", user.id).single(),
      supabase.from("propostas").select("*").eq("licitacao_id", id).eq("user_id", user.id).maybeSingle(),
      supabase.from("empresa").select("*").eq("user_id", empresaUserId).maybeSingle(),
      supabase.from("proposta_configuracao").select("*").eq("user_id", empresaUserId).maybeSingle(),
      supabase.from("documentos").select("*").eq("user_id", empresaUserId).order("created_at", { ascending: false }),
    ]);

    if (!licitacao) return NextResponse.json({ erro: "Licitação não encontrada." }, { status: 404 });
    const analise = proposta?.analise_edital as AnaliseEdital | null;
    if (!analise) return NextResponse.json({ erro: "Analise o edital antes de gerar a proposta." }, { status: 409 });

    const arquivo = formData.get("arquivo_apoio");
    const imagemApoio = await lerImagemApoio(arquivo);
    const anexos = await baixarDocumentosExigidos(
      supabase,
      analise,
      (documentos ?? []) as Documento[],
    );

    const bytes = await gerarPdfProposta({
      empresa: normalizarEmpresa(empresa),
      configuracao: { ...CONFIGURACAO_PROPOSTA_PADRAO, ...(configuracao ?? {}) } as PropostaConfiguracao,
      licitacao,
      analise,
      itens,
      imagemApoio,
      anexos,
    });

    await supabase.from("propostas").upsert({
      user_id: user.id,
      licitacao_id: id,
      status: "gerada",
      validade_dias: configuracao?.validade_dias ?? CONFIGURACAO_PROPOSTA_PADRAO.validade_dias,
      observacoes: configuracao?.observacoes_padrao ?? "",
      itens,
      analise_edital: analise,
      edital_analisado_em: analise.analisadoEm,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,licitacao_id" });

    const nome = `Proposta_${arquivoSeguro(licitacao.numero_controle_pncp || id)}.pdf`;
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Não foi possível gerar a proposta.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}

function validarItens(valor: FormDataEntryValue | null): ItemPropostaPdf[] {
  if (typeof valor !== "string") throw new Error("Itens da proposta não informados.");
  const dados = JSON.parse(valor) as unknown;
  if (!Array.isArray(dados)) throw new Error("Formato de itens inválido.");
  return dados.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const registro = item as Record<string, unknown>;
    const numeroItem = Number(registro.numeroItem);
    const quantidade = Number(registro.quantidade);
    const valorUnitario = Number(registro.valorUnitario);
    if (!Number.isFinite(numeroItem) || !Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(valorUnitario) || valorUnitario <= 0) return [];
    return [{
      numeroItem,
      descricao: String(registro.descricao ?? ""),
      quantidade,
      unidadeMedida: String(registro.unidadeMedida ?? ""),
      marca: String(registro.marca ?? ""),
      valorUnitario,
    }];
  });
}

async function lerImagemApoio(valor: FormDataEntryValue | null) {
  if (!(valor instanceof File) || valor.size === 0) return null;
  if (valor.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB.");
  if (!new Set(["image/png", "image/jpeg"]).has(valor.type)) return null;
  return { nome: valor.name, tipo: valor.type, bytes: new Uint8Array(await valor.arrayBuffer()) };
}

async function baixarDocumentosExigidos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  analise: AnaliseEdital,
  documentos: Documento[],
): Promise<AnexoPdf[]> {
  const tipos = new Set(
    analise.documentos
      .filter((requisito) => requisito.status === "disponivel" && requisito.tipoDocumento)
      .map((requisito) => requisito.tipoDocumento as string),
  );
  const ids = new Set(
    analise.documentos
      .filter((requisito) => requisito.status === "disponivel" && requisito.documentoId)
      .map((requisito) => requisito.documentoId as string),
  );
  const tiposVinculados = new Set(
    analise.documentos
      .filter((requisito) => requisito.status === "disponivel" && requisito.documentoId && requisito.tipoDocumento)
      .map((requisito) => requisito.tipoDocumento as string),
  );
  const usados = new Set<string>();
  const anexos: AnexoPdf[] = [];
  for (const documento of documentos) {
    const corresponde = ids.has(documento.id) || (tipos.has(documento.tipo) && !tiposVinculados.has(documento.tipo));
    if (!corresponde || usados.has(documento.tipo)) continue;
    if (!documento.arquivo_nome.toLowerCase().endsWith(".pdf")) continue;
    const { data, error } = await supabase.storage.from("documentos").download(documento.arquivo_path);
    if (error || !data) continue;
    anexos.push({ nome: documento.nome, bytes: new Uint8Array(await data.arrayBuffer()) });
    usados.add(documento.tipo);
  }
  return anexos;
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
