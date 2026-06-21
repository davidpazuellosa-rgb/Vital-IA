"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_AVULSO } from "./types";

const BUCKET = "documentos";

export async function criarCliente(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const nome = ((formData.get("nome") as string) ?? "").trim();
  const orgao = ((formData.get("orgao") as string) ?? "").trim();
  if (!nome) throw new Error("Informe o nome do cliente.");

  const { data, error } = await supabase
    .from("clientes")
    .insert({ user_id: user.id, nome, orgao })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/clientes");
  return data.id as string;
}

export async function removerCliente(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  // remove arquivos do storage (best-effort)
  const { data: docs } = await supabase
    .from("cliente_documentos")
    .select("arquivo_path")
    .eq("cliente_id", id)
    .eq("user_id", user.id);
  const paths = (docs ?? []).map((d) => d.arquivo_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);

  const { error } = await supabase.from("clientes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/clientes");
}

export async function atualizarClienteStatus(id: string, status: string, proximoPasso: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("clientes")
    .update({ status: status.trim(), proximo_passo: proximoPasso.trim() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${id}`);
}

export async function criarContratacao(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const clienteId = (formData.get("clienteId") as string) ?? "";
  const titulo = ((formData.get("titulo") as string) ?? "").trim();
  const identificador = ((formData.get("identificador") as string) ?? "").trim();
  if (!clienteId) throw new Error("Cliente inválido.");
  if (!titulo) throw new Error("Informe o título da licitação/contratação.");

  const { data, error } = await supabase
    .from("contratacoes")
    .insert({ cliente_id: clienteId, user_id: user.id, titulo, identificador })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${clienteId}`);
  return data.id as string;
}

export async function removerContratacao(id: string, clienteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: docs } = await supabase
    .from("cliente_documentos")
    .select("arquivo_path")
    .eq("contratacao_id", id)
    .eq("user_id", user.id);
  const paths = (docs ?? []).map((d) => d.arquivo_path).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);

  const { error } = await supabase.from("contratacoes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${clienteId}`);
}

export async function atualizarContratacaoStatus(id: string, clienteId: string, status: string, proximoPasso: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("contratacoes")
    .update({ status: status.trim(), proximo_passo: proximoPasso.trim() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${clienteId}/contratacao/${id}`);
}

export type RegistrarClienteDocInput = {
  clienteId: string;
  contratacaoId: string;
  tipo: string;
  nome: string;
  path: string;
  arquivoNome: string;
};

export type ContratacaoDestinoProposta = {
  id: string;
  titulo: string;
  identificador: string;
};

export type ClienteDestinoProposta = {
  id: string;
  nome: string;
  orgao: string;
  contratacoes: ContratacaoDestinoProposta[];
};

export type DestinosPropostaFinal = {
  clientes: ClienteDestinoProposta[];
  sugestaoClienteId: string;
  sugestaoContratacaoId: string;
};

export async function listarDestinosPropostaFinal(licitacaoId: string): Promise<DestinosPropostaFinal> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const [{ data: licitacao }, { data: clientes, error: clientesError }] = await Promise.all([
    supabase
      .from("saved_licitacoes")
      .select("id, orgao, titulo, numero_controle_pncp")
      .eq("id", licitacaoId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("clientes")
      .select("id, nome, orgao")
      .eq("user_id", user.id)
      .order("nome", { ascending: true }),
  ]);
  if (!licitacao) throw new Error("Licitação não encontrada.");
  if (clientesError) throw new Error(clientesError.message);

  const clientesBase = (clientes ?? []) as { id: string; nome: string; orgao: string }[];
  const clienteIds = clientesBase.map((cliente) => cliente.id);
  const { data: contratacoes, error: contratacoesError } = clienteIds.length
    ? await supabase
      .from("contratacoes")
      .select("id, cliente_id, titulo, identificador")
      .eq("user_id", user.id)
      .in("cliente_id", clienteIds)
      .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (contratacoesError) throw new Error(contratacoesError.message);

  const contratacoesPorCliente = new Map<string, ContratacaoDestinoProposta[]>();
  for (const item of (contratacoes ?? []) as { id: string; cliente_id: string; titulo: string; identificador: string }[]) {
    const lista = contratacoesPorCliente.get(item.cliente_id) ?? [];
    lista.push({ id: item.id, titulo: item.titulo, identificador: item.identificador });
    contratacoesPorCliente.set(item.cliente_id, lista);
  }

  const clientesDestino = clientesBase.map((cliente) => ({
    id: cliente.id,
    nome: cliente.nome,
    orgao: cliente.orgao,
    contratacoes: contratacoesPorCliente.get(cliente.id) ?? [],
  }));

  const normalizar = (valor: string) =>
    valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const orgao = normalizar(String(licitacao.orgao ?? ""));
  const numeroControle = String(licitacao.numero_controle_pncp ?? "");
  const contratacaoSugerida = clientesDestino
    .flatMap((cliente) => cliente.contratacoes.map((contratacao) => ({ cliente, contratacao })))
    .find(({ contratacao }) => contratacao.identificador === numeroControle);
  const clienteSugerido = contratacaoSugerida?.cliente ?? clientesDestino.find((cliente) => {
    const nome = normalizar(cliente.nome);
    const orgaoCliente = normalizar(cliente.orgao);
    return Boolean(orgao) && (orgao.includes(nome) || nome.includes(orgao) || orgao.includes(orgaoCliente) || orgaoCliente.includes(orgao));
  });

  return {
    clientes: clientesDestino,
    sugestaoClienteId: clienteSugerido?.id ?? clientesDestino[0]?.id ?? "",
    sugestaoContratacaoId: contratacaoSugerida?.contratacao.id ?? "",
  };
}

export async function garantirContratacaoPropostaFinal(licitacaoId: string, clienteId: string, contratacaoId?: string): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  if (!clienteId) throw new Error("Selecione o cliente onde a proposta final será salva.");

  const [{ data: cliente }, { data: licitacao }] = await Promise.all([
    supabase.from("clientes").select("id").eq("id", clienteId).eq("user_id", user.id).single(),
    supabase
      .from("saved_licitacoes")
      .select("titulo, orgao, numero_controle_pncp")
      .eq("id", licitacaoId)
      .eq("user_id", user.id)
      .single(),
  ]);
  if (!cliente) throw new Error("Cliente não encontrado.");
  if (!licitacao) throw new Error("Licitação não encontrada.");

  if (contratacaoId) {
    const { data: contratacao, error } = await supabase
      .from("contratacoes")
      .select("id")
      .eq("id", contratacaoId)
      .eq("cliente_id", clienteId)
      .eq("user_id", user.id)
      .single();
    if (error || !contratacao) throw new Error("Contratação não encontrada neste cliente.");
    return contratacao.id as string;
  }

  const identificador = String(licitacao.numero_controle_pncp ?? "");
  if (identificador) {
    const { data: existente } = await supabase
      .from("contratacoes")
      .select("id")
      .eq("cliente_id", clienteId)
      .eq("user_id", user.id)
      .eq("identificador", identificador)
      .maybeSingle();
    if (existente?.id) return existente.id as string;
  }

  const titulo = String(licitacao.titulo || licitacao.orgao || "Licitação");
  const { data: nova, error } = await supabase
    .from("contratacoes")
    .insert({ cliente_id: clienteId, user_id: user.id, titulo, identificador })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/vital-norte/clientes/" + clienteId);
  return nova.id as string;
}

export async function registrarClienteDocumento(input: RegistrarClienteDocInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  if (!input.path.startsWith(user.id + "/")) throw new Error("Caminho de arquivo inválido.");

  const { data: contratacao, error: destinoError } = await supabase
    .from("contratacoes")
    .select("id")
    .eq("id", input.contratacaoId)
    .eq("cliente_id", input.clienteId)
    .eq("user_id", user.id)
    .single();
  if (destinoError || !contratacao) {
    await supabase.storage.from(BUCKET).remove([input.path]);
    throw new Error("Cliente ou contratação inválida para este documento.");
  }

  const { error } = await supabase.from("cliente_documentos").insert({
    cliente_id: input.clienteId,
    contratacao_id: input.contratacaoId,
    user_id: user.id,
    tipo: input.tipo || CATEGORIA_AVULSO,
    nome: input.nome,
    arquivo_path: input.path,
    arquivo_nome: input.arquivoNome,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([input.path]);
    throw new Error(error.message);
  }
  revalidatePath(`/vital-norte/clientes/${input.clienteId}/contratacao/${input.contratacaoId}`);
}

export async function removerClienteDocumento(id: string, clienteId: string, contratacaoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: doc } = await supabase
    .from("cliente_documentos")
    .select("arquivo_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (doc?.arquivo_path) await supabase.storage.from(BUCKET).remove([doc.arquivo_path]);

  const { error } = await supabase.from("cliente_documentos").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${clienteId}/contratacao/${contratacaoId}`);
}
