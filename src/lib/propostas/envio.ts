"use server";

import { revalidatePath } from "next/cache";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { detectarPlataforma, hostCasa, hostDeLink } from "@/lib/licitacoes/plataforma-origem";
import { createClient } from "@/lib/supabase/server";
import type { DadosEnvio, ItemEnvio, PacoteEnvio } from "./envio-types";

function itensDe(bruto: unknown): ItemEnvio[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((i): ItemEnvio[] => {
    if (!i || typeof i !== "object") return [];
    const r = i as Record<string, unknown>;
    const numeroItem = Number(r.numeroItem);
    if (!Number.isFinite(numeroItem)) return [];
    return [{
      numeroItem,
      descricao: String(r.descricao ?? ""),
      marca: String(r.marca ?? ""),
      quantidade: r.quantidade == null ? null : Number(r.quantidade),
      unidadeMedida: String(r.unidadeMedida ?? ""),
      valorUnitario: Number(r.valorUnitario) || 0,
      selecionado: r.selecionado !== false,
    }];
  });
}

type AnaliseResumo = { documentos?: Array<{ status?: string }>; declaracoes?: unknown[] };

/** Tudo que o diálogo "Enviar proposta" precisa, numa chamada só. */
export async function obterPacoteEnvio(licitacaoId: string): Promise<PacoteEnvio> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: lic, error } = await supabase
    .from("saved_licitacoes")
    .select("id, numero_controle_pncp, titulo, orgao, uf, municipio, modalidade, link_origem, data_abertura_proposta, data_encerramento_proposta, etapa")
    .eq("id", licitacaoId)
    .eq("user_id", user.id)
    .single();
  if (error || !lic) throw new Error("Licitação não encontrada.");

  const [{ data: proposta }, { data: sistemas }, empresaUserId] = await Promise.all([
    supabase
      .from("propostas")
      .select("status, itens, analise_edital, enviada_em, protocolo_envio, valor_enviado, observacoes_envio, comprovante_path, comprovante_nome")
      .eq("licitacao_id", licitacaoId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("sistemas_licitacao").select("id, nome, url, login").order("ordem", { ascending: true }),
    resolverEmpresaUserId(supabase, user.id),
  ]);

  const plataforma = detectarPlataforma(lic.link_origem);
  const hostAlvo = plataforma?.host ?? hostDeLink(lic.link_origem);
  const sistema = hostAlvo
    ? ((sistemas ?? []).find((s) => {
        const h = hostDeLink(s.url);
        return h ? hostCasa(hostAlvo, h) || hostCasa(h, hostAlvo) : false;
      }) ?? null)
    : null;

  let resumo: PacoteEnvio["proposta"] = null;
  if (proposta) {
    const itens = itensDe(proposta.itens);
    const selecionados = itens.filter((i) => i.selecionado);
    const analise = (proposta.analise_edital ?? null) as AnaliseResumo | null;
    const docs = analise?.documentos ?? [];
    resumo = {
      status: String(proposta.status ?? "rascunho"),
      itens,
      valorTotal: selecionados.reduce((s, i) => s + (i.quantidade ?? 0) * i.valorUnitario, 0),
      itensSemPreco: selecionados.filter((i) => !(i.valorUnitario > 0)).length,
      analisada: Boolean(analise),
      documentosDisponiveis: docs.filter((d) => d.status === "disponivel").length,
      documentosPendentes: docs.filter((d) => d.status === "faltante" || d.status === "vencido").length,
      declaracoes: analise?.declaracoes?.length ?? 0,
    };
  }

  let envio: PacoteEnvio["envio"] = null;
  if (proposta?.enviada_em) {
    let comprovanteUrl: string | null = null;
    if (proposta.comprovante_path) {
      const { data } = await supabase.storage.from("documentos").createSignedUrl(proposta.comprovante_path, 3600);
      comprovanteUrl = data?.signedUrl ?? null;
    }
    envio = {
      enviadaEm: String(proposta.enviada_em),
      protocolo: String(proposta.protocolo_envio ?? ""),
      valor: proposta.valor_enviado == null ? null : Number(proposta.valor_enviado),
      observacoes: String(proposta.observacoes_envio ?? ""),
      comprovanteNome: proposta.comprovante_nome ?? null,
      comprovanteUrl,
    };
  }

  return {
    licitacao: {
      id: lic.id,
      numeroControlePNCP: lic.numero_controle_pncp,
      titulo: lic.titulo,
      orgao: lic.orgao,
      uf: lic.uf,
      municipio: lic.municipio,
      modalidade: lic.modalidade,
      linkOrigem: lic.link_origem,
      abertura: lic.data_abertura_proposta,
      encerramento: lic.data_encerramento_proposta,
      etapa: String(lic.etapa ?? "oportunidade"),
    },
    plataforma,
    sistema,
    proposta: resumo,
    envio,
    empresaUserId,
  };
}

/** Registra que a proposta foi enviada (pela pessoa, na plataforma) e move a licitação de etapa. */
export async function registrarEnvioProposta(licitacaoId: string, dados: DadosEnvio) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const quando = new Date(dados.enviadaEm);
  if (Number.isNaN(quando.getTime())) throw new Error("Data de envio inválida.");

  const { data: lic } = await supabase
    .from("saved_licitacoes")
    .select("id, link_origem")
    .eq("id", licitacaoId)
    .eq("user_id", user.id)
    .single();
  if (!lic) throw new Error("Licitação não encontrada.");

  const campos = {
    status: "enviada",
    plataforma_envio: detectarPlataforma(lic.link_origem)?.nome ?? "",
    enviada_em: quando.toISOString(),
    protocolo_envio: dados.protocolo.trim(),
    valor_enviado: dados.valor,
    observacoes_envio: dados.observacoes.trim(),
    comprovante_path: dados.comprovante?.path ?? null,
    comprovante_nome: dados.comprovante?.nome ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: existente } = await supabase
    .from("propostas")
    .select("id")
    .eq("licitacao_id", licitacaoId)
    .eq("user_id", user.id)
    .maybeSingle();
  const resultado = existente
    ? await supabase.from("propostas").update(campos).eq("id", existente.id)
    : await supabase.from("propostas").insert({ ...campos, licitacao_id: licitacaoId, user_id: user.id, itens: [] });
  if (resultado.error) throw new Error(resultado.error.message);

  const { error: etapaErro } = await supabase
    .from("saved_licitacoes")
    .update({ etapa: "proposta_enviada" })
    .eq("id", licitacaoId)
    .eq("user_id", user.id);
  if (etapaErro) throw new Error(etapaErro.message);

  revalidatePath("/minhas-licitacoes");
  revalidatePath("/licitacao/" + licitacaoId);
}

/** Desfaz o registro de envio (engano). O arquivo do comprovante continua guardado no bucket. */
export async function desfazerEnvioProposta(licitacaoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("propostas")
    .update({
      status: "rascunho",
      plataforma_envio: "",
      enviada_em: null,
      protocolo_envio: "",
      valor_enviado: null,
      observacoes_envio: "",
      comprovante_path: null,
      comprovante_nome: null,
      updated_at: new Date().toISOString(),
    })
    .eq("licitacao_id", licitacaoId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  const { error: etapaErro } = await supabase
    .from("saved_licitacoes")
    .update({ etapa: "proposta_pronta" })
    .eq("id", licitacaoId)
    .eq("user_id", user.id);
  if (etapaErro) throw new Error(etapaErro.message);

  revalidatePath("/minhas-licitacoes");
  revalidatePath("/licitacao/" + licitacaoId);
}
