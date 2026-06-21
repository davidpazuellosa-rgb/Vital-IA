"use server";

import { revalidatePath } from "next/cache";
import type { Documento } from "@/lib/documentos/types";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { buscarArquivosPncp, lerArquivoEdital } from "@/lib/licitacoes/providers/pncp-arquivos";
import { buscarItensPncp } from "@/lib/licitacoes/providers/pncp-itens";
import { createClient } from "@/lib/supabase/server";
import { analisarConteudoEdital, analisarEditalHibrido, type AnaliseEdital } from "./analise-edital";
import { extrairTextoPdfComOcrGroq, obterClienteGroq } from "./groq";
import { REPRESENTANTES_LEGAIS } from "./types";

function texto(formData: FormData, campo: string): string {
  return ((formData.get(campo) as string) ?? "").trim();
}

function numero(valor: FormDataEntryValue | null): number | null {
  if (typeof valor !== "string" || valor.trim() === "") return null;
  const convertido = Number(valor.replace(",", "."));
  return Number.isFinite(convertido) ? convertido : null;
}

export async function salvarConfiguracaoProposta(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

  const validade = numero(formData.get("validade_dias"));
  const representante = REPRESENTANTES_LEGAIS.find(
    (item) => item.nome === texto(formData, "representante_legal"),
  );
  const { error } = await supabase.from("proposta_configuracao").upsert({
    user_id: empresaUserId,
    validade_dias: validade && validade > 0 ? Math.round(validade) : 60,
    impostos_inclusos: formData.get("impostos_inclusos") === "on",
    representante_legal: representante?.nome ?? "",
    representante_cargo: representante?.cargo ?? "",
    observacoes_padrao: texto(formData, "observacoes_padrao"),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/dados");
}

export async function analisarEditalLicitacao(licitacaoId: string): Promise<AnaliseEdital> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);

  const [{ data: licitacao }, { data: documentos }, { data: empresa }] = await Promise.all([
    supabase
      .from("saved_licitacoes")
      .select("id, numero_controle_pncp")
      .eq("id", licitacaoId)
      .eq("user_id", user.id)
      .single(),
    supabase.from("documentos").select("*").eq("user_id", empresaUserId).order("created_at", { ascending: false }),
    supabase.from("empresa").select("porte, natureza_juridica").eq("user_id", empresaUserId).maybeSingle(),
  ]);
  if (!licitacao) throw new Error("Licitação não encontrada");

  const [arquivosPncp, itens] = await Promise.all([
    buscarArquivosPncp(licitacao.numero_controle_pncp),
    buscarItensPncp(licitacao.numero_controle_pncp),
  ]);
  const groqConfigurado = Boolean(obterClienteGroq());
  const arquivos: Awaited<ReturnType<typeof lerArquivoEdital>>[] = [];
  for (const arquivo of arquivosPncp) {
    arquivos.push(await lerArquivoEdital(arquivo, {
      ocr: groqConfigurado ? extrairTextoPdfComOcrGroq : undefined,
    }));
  }
  let analise: AnaliseEdital = analisarConteudoEdital({
    arquivos,
    documentosEmpresa: (documentos ?? []) as Documento[],
    itens,
  });

  if (groqConfigurado) {
    try {
      console.info("[Análise] Executando análise híbrida RegEx + Groq.");
      analise = await analisarEditalHibrido({
        arquivos,
        documentosEmpresa: (documentos ?? []) as Documento[],
        itens,
        contextoEmpresa: [empresa?.porte && `Porte: ${empresa.porte}`, empresa?.natureza_juridica && `Natureza jurídica: ${empresa.natureza_juridica}`].filter(Boolean).join("; "),
      });
    } catch (error) {
      console.error("[Análise] Groq indisponível; resultado local preservado:", error instanceof Error ? error.message : error);
      analise.alertas.push("A análise semântica da Groq não pôde ser concluída. O checklist foi gerado pelo parser local e deve ser revisado.");
    }
  } else {
    analise.alertas.push("GROQ_API_KEY não configurada. Análise realizada somente pelo parser local.");
  }

  const { error } = await supabase.from("propostas").upsert({
    user_id: user.id,
    licitacao_id: licitacaoId,
    analise_edital: analise,
    edital_analisado_em: analise.analisadoEm,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,licitacao_id" });
  if (error) throw new Error(error.message);

  return analise;
}
