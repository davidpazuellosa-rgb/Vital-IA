"use server";

import { revalidatePath } from "next/cache";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIA_AVULSO } from "./types";
import { buscarDadosCnpj } from "@/lib/nota-fiscal/actions";
import type { NotaFiscalItem } from "@/lib/nota-fiscal/types";
import { REPRESENTANTES_LEGAIS } from "@/lib/propostas/types";

/** Busca os dados do órgão pelo CNPJ (BrasilAPI) e salva no cliente (para reuso na NF-e). */
export async function preencherDadosOrgaoCliente(clienteId: string, cnpj: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const dados = await buscarDadosCnpj(cnpj);
  const { error } = await supabase
    .from("clientes")
    .update({
      cnpj: cnpj.replace(/\D/g, ""),
      cep: dados.cep,
      logradouro: dados.logradouro,
      numero: dados.numero,
      bairro: dados.bairro,
      municipio: dados.municipio,
      uf: dados.uf,
    })
    .eq("id", clienteId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/vital-norte/clientes/${clienteId}`);
  return dados.nome;
}

const BUCKET = "documentos";
const A4: [number, number] = [595.28, 841.89];
const MARGEM = 52;

type AssinanteDeclaracaoEntrega = "ruy" | "pazu";

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

export async function gerarDeclaracaoEntrega({
  clienteId,
  contratacaoId,
  assinante,
}: {
  clienteId: string;
  contratacaoId: string;
  assinante: AssinanteDeclaracaoEntrega;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const representante = assinante === "ruy"
    ? REPRESENTANTES_LEGAIS.find((item) => item.nomeCurto.toLowerCase() === "ruy")
    : REPRESENTANTES_LEGAIS.find((item) => item.nomeCurto.toLowerCase() === "david");
  if (!representante) throw new Error("Representante inválido.");

  const [{ data: cliente }, { data: contratacao }, { data: nota }, { data: empresa }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", clienteId).eq("user_id", user.id).single(),
    supabase.from("contratacoes").select("*").eq("id", contratacaoId).eq("cliente_id", clienteId).eq("user_id", user.id).single(),
    supabase
      .from("notas_fiscais")
      .select("numero, serie, itens, valor_total, created_at")
      .eq("contratacao_id", contratacaoId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("empresa").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!cliente) throw new Error("Cliente não encontrado.");
  if (!contratacao) throw new Error("Licitação não encontrada neste cliente.");

  const itens = normalizarItensNota(nota?.itens);
  if (itens.length === 0) {
    throw new Error("Nenhum item vendido encontrado. Emita ou salve uma nota fiscal nesta contratação antes de gerar a declaração.");
  }

  const bytes = await gerarPdfDeclaracaoEntrega({
    empresa: (empresa ?? {}) as Record<string, unknown>,
    cliente: cliente as Record<string, unknown>,
    contratacao: contratacao as Record<string, unknown>,
    nota: (nota ?? {}) as Record<string, unknown>,
    itens,
    representante,
  });

  const docId = crypto.randomUUID();
  const identificador = arquivoSeguro(String(contratacao.identificador || contratacao.titulo || contratacaoId));
  const sufixo = assinante === "ruy" ? "Ruy" : "Pazu";
  const arquivoNome = `Declaracao_Entrega_${identificador}_${sufixo}.pdf`;
  const path = `${user.id}/clientes/${clienteId}/${contratacaoId}/${docId}/${arquivoNome}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(bytes), {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("cliente_documentos").insert({
    cliente_id: clienteId,
    contratacao_id: contratacaoId,
    user_id: user.id,
    tipo: "declaracao_entrega",
    nome: `Declaração de Entrega — ${sufixo}`,
    arquivo_path: path,
    arquivo_nome: arquivoNome,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }

  revalidatePath(`/vital-norte/clientes/${clienteId}/contratacao/${contratacaoId}`);
}

function normalizarItensNota(valor: unknown): NotaFiscalItem[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((item) => item as Partial<NotaFiscalItem>)
    .filter((item) => item.descricao)
    .map((item) => ({
      descricao: String(item.descricao ?? ""),
      ncm: String(item.ncm ?? ""),
      cfop: String(item.cfop ?? ""),
      unidade: String(item.unidade ?? "UN"),
      quantidade: Number(item.quantidade) || 0,
      valor_unitario: Number(item.valor_unitario) || 0,
    }));
}

async function gerarPdfDeclaracaoEntrega({
  empresa,
  cliente,
  contratacao,
  nota,
  itens,
  representante,
}: {
  empresa: Record<string, unknown>;
  cliente: Record<string, unknown>;
  contratacao: Record<string, unknown>;
  nota: Record<string, unknown>;
  itens: NotaFiscalItem[];
  representante: (typeof REPRESENTANTES_LEGAIS)[number];
}) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(A4);
  const ctx = { doc, page, regular, bold, y: 785 };
  const empresaNome = textoValor(empresa.nome_fantasia) || textoValor(empresa.razao_social) || "Vital Norte";
  const razaoSocial = textoValor(empresa.razao_social) || empresaNome;
  const clienteNome = textoValor(cliente.nome) || textoValor(cliente.orgao) || "Cliente";
  const enderecoEntrega = [cliente.logradouro, cliente.numero, cliente.bairro, cliente.municipio, cliente.uf]
    .map(textoValor)
    .filter(Boolean)
    .join(", ");

  cabecalho(ctx, empresaNome);
  titulo(ctx, "DECLARAÇÃO DE ENTREGA");
  paragrafo(ctx, `A ${razaoSocial}, inscrita no CNPJ ${textoValor(empresa.cnpj) || "-"}, declara para os devidos fins que realizou a entrega dos itens vendidos ao cliente abaixo identificado.`);
  espaco(ctx, 10);
  campo(ctx, "Cliente / órgão", clienteNome);
  campo(ctx, "CNPJ", textoValor(cliente.cnpj) || "-");
  campo(ctx, "Endereço de entrega", enderecoEntrega || "-");
  campo(ctx, "Licitação / contratação", [contratacao.titulo, contratacao.identificador].map(textoValor).filter(Boolean).join(" — "));
  campo(ctx, "Nota fiscal", textoValor(nota.numero) ? `NF ${textoValor(nota.numero)}${textoValor(nota.serie) ? ` / Série ${textoValor(nota.serie)}` : ""}` : "Não informada");
  espaco(ctx, 12);
  secao(ctx, "Itens Entregues");
  itens.forEach((item, index) => {
    const total = (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0);
    paragrafo(
      ctx,
      `${index + 1}. ${item.descricao} — Qtd.: ${formatarNumero(item.quantidade)} ${item.unidade || "UN"} — Valor unit.: ${formatarMoeda(item.valor_unitario)} — Total: ${formatarMoeda(total)}`,
      9,
    );
  });

  espaco(ctx, 24);
  paragrafo(ctx, "Declaramos que os itens acima foram entregues em conformidade com a contratação, para conferência e recebimento pelo órgão/cliente.", 10);
  espaco(ctx, 34);
  centralizado(ctx, `${textoValor(empresa.municipio) || "Manaus"}, ${formatarDataLonga(new Date())}.`);
  espaco(ctx, 46);
  linhaAssinatura(ctx, representante.nome, representante.cargo, razaoSocial);

  doc.setTitle(`Declaração de Entrega - ${textoValor(contratacao.identificador) || clienteNome}`);
  doc.setAuthor(razaoSocial);
  doc.setCreator("Vital.IA");
  return doc.save();
}

function cabecalho(ctx: PdfCtx, empresa: string) {
  ctx.page.drawRectangle({ x: 0, y: 817, width: A4[0], height: 25, color: rgb(0.035, 0.58, 0.42) });
  ctx.page.drawText(limparPdf(empresa).toUpperCase(), { x: MARGEM, y: 825, size: 8, font: ctx.bold, color: rgb(1, 1, 1) });
}

type PdfCtx = { doc: PDFDocument; page: PDFPage; regular: PDFFont; bold: PDFFont; y: number };

function titulo(ctx: PdfCtx, valor: string) {
  centralizado(ctx, valor, 16, true);
  espaco(ctx, 18);
}

function secao(ctx: PdfCtx, valor: string) {
  garantir(ctx, 32);
  ctx.page.drawRectangle({ x: MARGEM, y: ctx.y - 3, width: A4[0] - MARGEM * 2, height: 22, color: rgb(0.95, 0.97, 0.96) });
  ctx.page.drawRectangle({ x: MARGEM, y: ctx.y - 3, width: 3, height: 22, color: rgb(0.035, 0.58, 0.42) });
  ctx.page.drawText(limparPdf(valor), { x: MARGEM + 11, y: ctx.y + 4, size: 10, font: ctx.bold, color: rgb(0.09, 0.14, 0.13) });
  ctx.y -= 26;
}

function campo(ctx: PdfCtx, rotulo: string, valor: string) {
  paragrafo(ctx, `${rotulo}: ${valor || "-"}`, 9);
}

function paragrafo(ctx: PdfCtx, valor: string, size = 10) {
  const linhas = quebrar(limparPdf(valor), ctx.regular, size, A4[0] - MARGEM * 2);
  garantir(ctx, linhas.length * (size + 4));
  for (const linha of linhas) {
    ctx.page.drawText(linha, { x: MARGEM, y: ctx.y, size, font: ctx.regular, color: rgb(0.09, 0.14, 0.13) });
    ctx.y -= size + 4;
  }
}

function centralizado(ctx: PdfCtx, valor: string, size = 10, bold = false) {
  const font = bold ? ctx.bold : ctx.regular;
  const linhas = quebrar(limparPdf(valor), font, size, A4[0] - MARGEM * 2);
  garantir(ctx, linhas.length * (size + 4));
  for (const linha of linhas) {
    const largura = font.widthOfTextAtSize(linha, size);
    ctx.page.drawText(linha, { x: (A4[0] - largura) / 2, y: ctx.y, size, font, color: rgb(0.09, 0.14, 0.13) });
    ctx.y -= size + 4;
  }
}

function linhaAssinatura(ctx: PdfCtx, nome: string, cargo: string, empresa: string) {
  const x1 = MARGEM + 55;
  const x2 = A4[0] - MARGEM - 55;
  ctx.page.drawLine({ start: { x: x1, y: ctx.y }, end: { x: x2, y: ctx.y }, thickness: 0.8, color: rgb(0.09, 0.14, 0.13) });
  ctx.y -= 15;
  centralizado(ctx, nome, 10, true);
  centralizado(ctx, cargo, 8);
  centralizado(ctx, empresa, 8);
}

function espaco(ctx: PdfCtx, altura: number) {
  garantir(ctx, altura);
  ctx.y -= altura;
}

function garantir(ctx: PdfCtx, altura: number) {
  if (ctx.y - altura >= 56) return;
  ctx.page = ctx.doc.addPage(A4);
  ctx.y = 785;
  cabecalho(ctx, "Vital Norte");
}

function quebrar(valor: string, font: PDFFont, size: number, larguraMaxima: number) {
  const palavras = valor.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (font.widthOfTextAtSize(teste, size) <= larguraMaxima) {
      atual = teste;
    } else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : ["-"];
}

function textoValor(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : valor == null ? "" : String(valor).trim();
}

function limparPdf(valor: string) {
  return valor.replace(/\s+/g, " ").trim() || "-";
}

function formatarNumero(valor: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(Number(valor) || 0);
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor) || 0);
}

function formatarDataLonga(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(data);
}

function arquivoSeguro(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "contratacao";
}
