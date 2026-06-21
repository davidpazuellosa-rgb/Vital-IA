"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarEtapa, UnifiedLicitacao, type EtapaSlug } from "./types";
import { buscarArquivosPncp } from "./providers/pncp-arquivos";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_DOCS = "documentos";

function sanitizarNomeArquivo(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .slice(-120) || "documento.pdf";
}

/**
 * Anexa os arquivos do edital (PNCP) a uma contratação, como tipo "edital".
 * Best-effort: ignora falhas individuais e não duplica se já houver edital.
 */
async function anexarEditalDaLicitacao(
  supabase: SupabaseClient,
  userId: string,
  clienteId: string,
  contratacaoId: string,
  numeroControlePNCP: string,
) {
  if (!numeroControlePNCP) return;

  const { count } = await supabase
    .from("cliente_documentos")
    .select("id", { count: "exact", head: true })
    .eq("contratacao_id", contratacaoId)
    .eq("tipo", "edital");
  if ((count ?? 0) > 0) return; // já tem edital anexado

  let arquivos: Awaited<ReturnType<typeof buscarArquivosPncp>> = [];
  try {
    arquivos = await buscarArquivosPncp(numeroControlePNCP);
  } catch {
    return;
  }

  for (const arquivo of arquivos) {
    try {
      const resp = await fetch(arquivo.url, { cache: "no-store" });
      if (!resp.ok) continue;
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const contentType = resp.headers.get("content-type") || "application/pdf";
      const baseNome = arquivo.titulo.toLowerCase().endsWith(".pdf") ? arquivo.titulo : `${arquivo.titulo}.pdf`;
      const docId = crypto.randomUUID();
      const path = `${userId}/clientes/${clienteId}/${docId}/${sanitizarNomeArquivo(baseNome)}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET_DOCS)
        .upload(path, bytes, { contentType, upsert: false });
      if (upErr) continue;

      const { error: insErr } = await supabase.from("cliente_documentos").insert({
        cliente_id: clienteId,
        contratacao_id: contratacaoId,
        user_id: userId,
        tipo: "edital",
        nome: arquivo.titulo,
        arquivo_path: path,
        arquivo_nome: baseNome,
      });
      if (insErr) await supabase.storage.from(BUCKET_DOCS).remove([path]);
    } catch {
      // ignora arquivo problemático
    }
  }
}

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
    .update({ etapa: normalizarEtapa(etapa) })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minhas-licitacoes");
}

export async function marcarPropostaRecusada(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("saved_licitacoes")
    .update({ etapa: "perdida" satisfies EtapaSlug })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/minhas-licitacoes");
  revalidatePath("/licitacao/" + id);
}

export async function converterLicitacaoEmCliente(id: string): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: licitacao, error: licitacaoError } = await supabase
    .from("saved_licitacoes")
    .select("id, numero_controle_pncp, plataforma, titulo, descricao, orgao, uf, municipio, modalidade, situacao, valor_estimado, data_abertura_proposta, data_encerramento_proposta, link_origem")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (licitacaoError || !licitacao) throw new Error("Licitação não encontrada.");

  const nomeCliente = String(licitacao.orgao || licitacao.titulo || "Cliente da licitação").trim();
  const { data: clienteExistente } = await supabase
    .from("clientes")
    .select("id")
    .eq("user_id", user.id)
    .eq("nome", nomeCliente)
    .maybeSingle();

  let clienteId = clienteExistente?.id as string | undefined;
  if (!clienteId) {
    const observacoes = [
      "Cliente criado automaticamente a partir de proposta feita.",
      licitacao.plataforma && "Plataforma: " + licitacao.plataforma,
      licitacao.uf && "UF: " + licitacao.uf,
      licitacao.municipio && "Município: " + licitacao.municipio,
      licitacao.link_origem && "Origem: " + licitacao.link_origem,
    ].filter(Boolean).join("\n");
    const { data: novoCliente, error: clienteError } = await supabase
      .from("clientes")
      .insert({
        user_id: user.id,
        nome: nomeCliente,
        orgao: String(licitacao.orgao ?? ""),
        observacoes,
        status: "Proposta feita",
        proximo_passo: "Acompanhar resultado, habilitação, empenho e contrato.",
      })
      .select("id")
      .single();
    if (clienteError) throw new Error(clienteError.message);
    clienteId = novoCliente.id as string;
  }

  const identificador = String(licitacao.numero_controle_pncp ?? "");
  const { data: contratacaoExistente } = await supabase
    .from("contratacoes")
    .select("id")
    .eq("user_id", user.id)
    .eq("cliente_id", clienteId)
    .eq("identificador", identificador)
    .maybeSingle();

  let contratacaoId = contratacaoExistente?.id as string | undefined;
  if (!contratacaoId) {
    const detalhes = [
      licitacao.modalidade && "Modalidade: " + licitacao.modalidade,
      licitacao.situacao && "Situação: " + licitacao.situacao,
      licitacao.valor_estimado != null && "Valor estimado: R$ " + Number(licitacao.valor_estimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      licitacao.data_abertura_proposta && "Abertura: " + licitacao.data_abertura_proposta,
      licitacao.data_encerramento_proposta && "Encerramento: " + licitacao.data_encerramento_proposta,
    ].filter(Boolean).join(" | ");
    const { data: novaContratacao, error: contratacaoError } = await supabase
      .from("contratacoes")
      .insert({
        cliente_id: clienteId,
        user_id: user.id,
        titulo: String(licitacao.titulo || licitacao.descricao || "Licitação"),
        identificador,
        status: "Proposta feita",
        proximo_passo: detalhes || "Acompanhar a proposta enviada.",
      })
      .select("id")
      .single();
    if (contratacaoError) throw new Error(contratacaoError.message);
    contratacaoId = novaContratacao.id as string;
  }

  const { error: etapaError } = await supabase
    .from("saved_licitacoes")
    .update({ etapa: "vencida" satisfies EtapaSlug })
    .eq("id", id)
    .eq("user_id", user.id);
  if (etapaError) throw new Error(etapaError.message);

  // Anexa os documentos do edital (PNCP) à contratação
  await anexarEditalDaLicitacao(supabase, user.id, clienteId, contratacaoId, identificador);

  revalidatePath("/minhas-licitacoes");
  revalidatePath("/vital-norte/clientes");
  revalidatePath("/vital-norte/clientes/" + clienteId);
  revalidatePath("/vital-norte/clientes/" + clienteId + "/contratacao/" + contratacaoId);
  return "/vital-norte/clientes/" + clienteId + "/contratacao/" + contratacaoId;
}
