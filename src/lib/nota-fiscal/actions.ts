"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { baixarArquivo, cancelarNFe, cartaCorrecaoNFe, consultarNFe, emitirNFe, motorAtivo } from "./engine";
import { calcularTotalItens, valorLinha, type NotaFiscal, type NotaFiscalItem } from "./types";

const PATH = "/vital-norte/nota-fiscal";
const BUCKET = "documentos";
const apenasDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export type DadosCnpj = {
  nome: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  codigoMunicipio: string; // IBGE 7 díg. (cMun) — necessário p/ emissão direta SEFAZ
  uf: string;
};

/** Busca razão social e endereço de um CNPJ na BrasilAPI (dados públicos da Receita). */
export async function buscarDadosCnpj(cnpj: string): Promise<DadosCnpj> {
  const doc = apenasDigitos(cnpj);
  if (doc.length !== 14) throw new Error("Informe um CNPJ com 14 dígitos.");

  let dados: Record<string, unknown>;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; VitalIA/1.0)", Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (r.status === 404) throw new Error("CNPJ não encontrado na base da Receita.");
    if (!r.ok) throw new Error(`Falha na consulta (HTTP ${r.status}).`);
    dados = await r.json();
  } catch (e) {
    if (e instanceof Error && e.message.includes("CNPJ")) throw e;
    throw new Error("Não foi possível consultar o CNPJ agora. Tente novamente.");
  }

  const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v != null ? String(v) : "");
  const logradouro = [txt(dados.descricao_tipo_logradouro), txt(dados.logradouro)].filter(Boolean).join(" ").trim();
  return {
    nome: txt(dados.razao_social),
    cep: apenasDigitos(txt(dados.cep)),
    logradouro,
    numero: txt(dados.numero),
    bairro: txt(dados.bairro),
    municipio: txt(dados.municipio),
    codigoMunicipio: apenasDigitos(txt(dados.codigo_municipio_ibge)),
    uf: txt(dados.uf).toUpperCase().slice(0, 2),
  };
}

type EmpresaEmitente = {
  cnpj: string;
  inscricao_estadual: string;
};

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Guarda um arquivo da NF-e (engine SEFAZ, que devolve base64) no Storage e
 * devolve uma URL assinada de longa duração. O fluxo de anexar reaproveita essa
 * URL via baixarArquivo, igual ao caminho Focus.
 */
async function guardarArquivoSefaz(
  supabase: ServerClient,
  empresaUserId: string,
  nome: string,
  ext: "xml" | "pdf",
  base64: string,
  contentType: string,
): Promise<string> {
  const bytes = Buffer.from(base64, "base64");
  const path = `${empresaUserId}/nfe/${nome}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (upErr) throw new Error(upErr.message);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 3650); // ~10 anos (guarda fiscal de 5)
  if (error || !data) throw new Error(error?.message ?? "Falha ao gerar URL do arquivo.");
  return data.signedUrl;
}

function parseItens(raw: string): NotaFiscalItem[] {
  let lista: unknown;
  try {
    lista = JSON.parse(raw || "[]");
  } catch {
    throw new Error("Itens inválidos.");
  }
  if (!Array.isArray(lista)) throw new Error("Itens inválidos.");
  const itens = lista
    .map((item) => {
      const i = item as Partial<NotaFiscalItem>;
      return {
        descricao: String(i.descricao ?? "").trim(),
        ncm: apenasDigitos(String(i.ncm ?? "")),
        cfop: apenasDigitos(String(i.cfop ?? "")),
        unidade: (String(i.unidade ?? "").trim() || "UN").toUpperCase(),
        quantidade: Number(i.quantidade) || 0,
        valor_unitario: Number(i.valor_unitario) || 0,
      } satisfies NotaFiscalItem;
    });
  if (itens.length === 0) {
    throw new Error("Adicione ao menos um item.");
  }
  // Validação fiscal (evita rejeição da SEFAZ por campo obrigatório/ inválido).
  // Valida TODOS os itens — sem descartar nenhum, para não mascarar dados inválidos.
  itens.forEach((it, idx) => {
    const n = idx + 1;
    if (!it.descricao) throw new Error(`Item ${n}: informe a descrição.`);
    if (it.quantidade <= 0) throw new Error(`Item ${n}: informe a quantidade.`);
    if (it.valor_unitario <= 0) throw new Error(`Item ${n}: informe o valor unitário.`);
    if (it.ncm.length !== 8 && it.ncm.length !== 2) {
      throw new Error(`Item ${n}: NCM deve ter 8 dígitos (ou 2 para gênero).`);
    }
    if (it.cfop.length !== 4) throw new Error(`Item ${n}: CFOP deve ter 4 dígitos.`);
  });
  return itens;
}

type CamposNota = {
  clienteId: string | null;
  contratacaoId: string | null;
  naturezaOperacao: string;
  observacoes: string;
  destinatarioNome: string;
  destinatarioDocumento: string;
  destIe: string;
  destIndIe: number;
  destCep: string;
  destLogradouro: string;
  destNumero: string;
  destBairro: string;
  destMunicipio: string;
  destCodigoMunicipio: string;
  destUf: string;
  itens: NotaFiscalItem[];
  valorTotal: number;
};

/** Lê e VALIDA os campos da nota a partir do FormData (compartilhado por criar e editar). */
function lerCamposNota(formData: FormData): CamposNota {
  const get = (k: string) => ((formData.get(k) as string) ?? "").trim();

  const destinatarioNome = get("destinatarioNome");
  const destinatarioDocumento = apenasDigitos(formData.get("destinatarioDocumento") as string);
  if (!destinatarioNome) throw new Error("Informe o nome do destinatário.");
  if (destinatarioDocumento.length !== 14 && destinatarioDocumento.length !== 11) {
    throw new Error("CNPJ (14 dígitos) ou CPF (11 dígitos) do destinatário inválido.");
  }

  // Endereço do destinatário é obrigatório na NF-e (evita rejeição na emissão).
  const destCep = apenasDigitos(formData.get("destinatarioCep") as string);
  const destLogradouro = get("destinatarioLogradouro");
  const destNumero = get("destinatarioNumero");
  const destBairro = get("destinatarioBairro");
  const destMunicipio = get("destinatarioMunicipio");
  const destUf = get("destinatarioUf").toUpperCase().slice(0, 2);
  if (!destLogradouro || !destNumero || !destBairro || !destMunicipio || destUf.length !== 2) {
    throw new Error(
      "Endereço do destinatário incompleto: logradouro, número, bairro, município e UF são obrigatórios.",
    );
  }
  if (destCep.length !== 8) throw new Error("CEP do destinatário inválido (8 dígitos).");

  const destIe = get("destinatarioIe");
  // indIEDest: 1 contribuinte, 2 isento, 9 não contribuinte. Sem valor válido, deriva da IE.
  const rawIndIe = Number(formData.get("destinatarioIndIe"));
  const destIndIe = [1, 2, 9].includes(rawIndIe) ? rawIndIe : destIe ? 1 : 9;

  const itens = parseItens((formData.get("itens") as string) ?? "[]");

  return {
    clienteId: get("clienteId") || null,
    contratacaoId: get("contratacaoId") || null,
    naturezaOperacao: get("naturezaOperacao") || "Venda de mercadoria",
    observacoes: get("observacoes"),
    destinatarioNome,
    destinatarioDocumento,
    destIe,
    destIndIe,
    destCep,
    destLogradouro,
    destNumero,
    destBairro,
    destMunicipio,
    destCodigoMunicipio: apenasDigitos(formData.get("destinatarioCodigoMunicipio") as string),
    destUf,
    itens,
    valorTotal: calcularTotalItens(itens),
  };
}

/** Erro amigável se cliente/contratação não pertencem ao usuário (a RLS já protege). */
async function conferirPertencimento(
  supabase: ServerClient,
  userId: string,
  clienteId: string | null,
  contratacaoId: string | null,
) {
  if (clienteId) {
    const { data } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) throw new Error("Cliente inválido.");
  }
  if (contratacaoId) {
    const { data } = await supabase
      .from("contratacoes")
      .select("id")
      .eq("id", contratacaoId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) throw new Error("Contratação inválida.");
  }
}

/** Colunas da nota a partir dos campos validados (compartilhado entre insert e update). */
function colunasNota(c: CamposNota) {
  return {
    cliente_id: c.clienteId,
    contratacao_id: c.contratacaoId,
    natureza_operacao: c.naturezaOperacao,
    observacoes: c.observacoes,
    destinatario_nome: c.destinatarioNome,
    destinatario_documento: c.destinatarioDocumento,
    destinatario_ie: c.destIe,
    destinatario_ind_ie: c.destIndIe,
    destinatario_cep: c.destCep,
    destinatario_logradouro: c.destLogradouro,
    destinatario_numero: c.destNumero,
    destinatario_bairro: c.destBairro,
    destinatario_municipio: c.destMunicipio,
    destinatario_uf: c.destUf,
    valor_total: c.valorTotal,
    itens: c.itens,
  };
  // destinatario_codigo_municipio (IBGE) é resolvido na EMISSÃO (BrasilAPI), não no form.
  // Por isso NÃO entra aqui — assim editar um rascunho não o sobrescreve.
}

export async function criarNotaFiscal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const c = lerCamposNota(formData);
  await conferirPertencimento(supabase, user.id, c.clienteId, c.contratacaoId);

  const ref = "nf-" + crypto.randomUUID();
  const { data, error } = await supabase
    .from("notas_fiscais")
    .insert({
      user_id: user.id,
      ref,
      destinatario_codigo_municipio: c.destCodigoMunicipio,
      ...colunasNota(c),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
  return data.id as string;
}

/** Atualiza um rascunho (só enquanto status = 'rascunho'). Revalida os mesmos campos. */
export async function atualizarNotaFiscalRascunho(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const c = lerCamposNota(formData);

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "rascunho") throw new Error("Apenas rascunhos podem ser editados.");

  await conferirPertencimento(supabase, user.id, c.clienteId, c.contratacaoId);

  const { error } = await supabase
    .from("notas_fiscais")
    .update({ ...colunasNota(c), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "rascunho");
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

const UF_EMITENTE = "AM"; // Vital Norte — Manaus/AM

function montarPayloadFocus(
  nota: NotaFiscal,
  empresa: EmpresaEmitente,
  itens: NotaFiscalItem[],
  referenciaContratacao = "",
): Record<string, unknown> {
  const doc = apenasDigitos(nota.destinatario_documento);
  const documentoDestinatario =
    doc.length === 14 ? { cnpj_destinatario: doc } : { cpf_destinatario: doc };
  // indIEDest: 1 contribuinte, 2 isento, 9 não contribuinte. Deriva da IE se nulo (compat).
  const indIe = nota.destinatario_ind_ie ?? (nota.destinatario_ie?.trim() ? 1 : 9);
  const contribuinte = indIe === 1;
  // Operação interestadual quando a UF do destinatário difere da do emitente (AM).
  const ufDest = (nota.destinatario_uf || "").toUpperCase();
  const interestadual = Boolean(ufDest) && ufDest !== UF_EMITENTE;

  // Informações adicionais: observações + referência da contratação (PROAD/empenho),
  // útil para notas a órgão público.
  const informacoesAdicionais = [
    nota.observacoes?.trim(),
    referenciaContratacao ? `Ref.: ${referenciaContratacao}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  // ─── Tratamento fiscal (Simples Nacional, Manaus/AM) ───
  // DIFAL interestadual: o emitente é Simples Nacional. Pela suspensão da cláusula nona
  // do Convênio ICMS 93/2015 (ADI 5469/STF), o contribuinte do Simples NÃO recolhe o
  // DIFAL (partilha) na venda interestadual a consumidor final não contribuinte. Por isso
  // NÃO populamos os campos de DIFAL (icms_valor_*_uf_*) mesmo quando `interestadual`.
  // ZFM/SUFRAMA: sem incentivo no momento — nenhum campo de desoneração/SUFRAMA é enviado.
  // Confirmar qualquer mudança de regime/benefício com a contabilidade.
  void interestadual;

  return {
    natureza_operacao: nota.natureza_operacao,
    data_emissao: new Date().toISOString(),
    tipo_documento: 1, // saída
    finalidade_emissao: 1, // NF-e normal
    consumidor_final: contribuinte ? 0 : 1,
    presenca_comprador: 9, // operação não presencial / outros
    ...(informacoesAdicionais ? { informacoes_adicionais_contribuinte: informacoesAdicionais } : {}),

    // Emitente — cadastrado no painel do provedor; aqui só o CNPJ.
    cnpj_emitente: apenasDigitos(empresa.cnpj),

    // Destinatário: indicador de IE alinhado ao consumidor_final acima.
    nome_destinatario: nota.destinatario_nome,
    ...documentoDestinatario,
    indicador_inscricao_estadual_destinatario: indIe,
    inscricao_estadual_destinatario: contribuinte ? nota.destinatario_ie : undefined,
    logradouro_destinatario: nota.destinatario_logradouro,
    numero_destinatario: nota.destinatario_numero,
    bairro_destinatario: nota.destinatario_bairro,
    municipio_destinatario: nota.destinatario_municipio,
    codigo_municipio_destinatario: nota.destinatario_codigo_municipio, // IBGE (engine SEFAZ)
    uf_destinatario: nota.destinatario_uf,
    cep_destinatario: apenasDigitos(nota.destinatario_cep),

    items: itens.map((item, indice) => ({
      numero_item: indice + 1,
      codigo_produto: `ITEM-${indice + 1}`,
      descricao: item.descricao,
      codigo_ncm: item.ncm,
      cfop: item.cfop,
      unidade_comercial: item.unidade,
      quantidade_comercial: item.quantidade,
      valor_unitario_comercial: item.valor_unitario,
      valor_bruto: valorLinha(item),
      unidade_tributavel: item.unidade,
      quantidade_tributavel: item.quantidade,
      valor_unitario_tributavel: item.valor_unitario,
      // --- Tributação: defaults de Simples Nacional. Ajustar para Regime Normal. ---
      icms_origem: 0,
      icms_situacao_tributaria: "102", // CSOSN 102 (Simples sem permissão de crédito)
      pis_situacao_tributaria: "07", // operação isenta da contribuição
      cofins_situacao_tributaria: "07",
    })),
  };
}

export type ResultadoEmissao = { ok: boolean; mensagem?: string };

export async function emitirNotaFiscal(id: string): Promise<ResultadoEmissao> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  // Integração fiscal precisa estar configurada. No Focus = token; na engine
  // direta SEFAZ a validação de config fica no próprio cliente (sefaz.ts).
  if (motorAtivo === "focus" && !process.env.FOCUS_NFE_TOKEN) {
    return {
      ok: false,
      mensagem: "Integração fiscal não configurada. Defina FOCUS_NFE_TOKEN (conta Focus + certificado A1) para emitir.",
    };
  }

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) return { ok: false, mensagem: "Nota não encontrada." };
  if (nota.status !== "rascunho") return { ok: false, mensagem: "Esta nota já foi enviada." };

  // Engine SEFAZ exige o código IBGE do município (cMun). Resolve aqui (antes do
  // compare-and-swap, p/ não consumir número se falhar): usa o que estiver salvo
  // ou busca pelo CNPJ do destinatário na BrasilAPI.
  let codigoMunicipioDest = nota.destinatario_codigo_municipio || "";
  if (motorAtivo === "sefaz" && !codigoMunicipioDest) {
    const docDest = apenasDigitos(nota.destinatario_documento);
    if (docDest.length === 14) {
      try {
        codigoMunicipioDest = (await buscarDadosCnpj(docDest)).codigoMunicipio;
      } catch {
        /* trata como não resolvido abaixo */
      }
    }
    if (!codigoMunicipioDest) {
      return {
        ok: false,
        mensagem: "Não foi possível obter o código IBGE do município do destinatário (necessário para a SEFAZ). Verifique o CNPJ/endereço.",
      };
    }
  }

  // Emitente vem de public.empresa (acervo compartilhado da empresa).
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);
  const { data: empresa } = await supabase
    .from("empresa")
    .select("cnpj, inscricao_estadual")
    .eq("user_id", empresaUserId)
    .maybeSingle();
  if (!empresa?.cnpj) {
    return { ok: false, mensagem: "Cadastre o CNPJ em Dados da Empresa antes de emitir." };
  }

  // Referência da contratação vinculada (PROAD/empenho) para infAdic.
  let referenciaContratacao = "";
  if (nota.contratacao_id) {
    const { data: ct } = await supabase
      .from("contratacoes")
      .select("titulo, identificador")
      .eq("id", nota.contratacao_id)
      .maybeSingle();
    if (ct) referenciaContratacao = [ct.identificador, ct.titulo].filter(Boolean).join(" — ");
  }

  const itens = (nota.itens ?? []) as NotaFiscalItem[];
  const payload = montarPayloadFocus(nota as NotaFiscal, empresa as EmpresaEmitente, itens, referenciaContratacao);

  // Compare-and-swap: só sai de "rascunho" uma vez (evita emissão dupla por clique repetido).
  const { data: marcada } = await supabase
    .from("notas_fiscais")
    .update({ status: "processando", payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "rascunho")
    .select("id");
  if (!marcada || marcada.length === 0) {
    return { ok: false, mensagem: "Esta nota já está sendo processada." };
  }

  // Engine SEFAZ: o app aloca a numeração (nNF) atomicamente — só após o
  // compare-and-swap, para não consumir número em clique duplicado (evita buracos).
  if (motorAtivo === "sefaz") {
    const { data: nAloc, error: nErr } = await supabase.rpc("proximo_numero_nfe", { p_serie: 1 });
    if (nErr || nAloc == null) {
      await supabase
        .from("notas_fiscais")
        .update({ status: "rascunho", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "processando");
      return { ok: false, mensagem: "Falha ao alocar a numeração da nota fiscal." };
    }
    payload.numero = String(nAloc);
    payload.serie = "1";
    payload.codigo_municipio_destinatario = codigoMunicipioDest;
  }

  let resultado;
  try {
    resultado = await emitirNFe(nota.ref, payload);
  } catch (e) {
    // Falha transitória (rede/5xx): volta para rascunho para permitir nova tentativa.
    // É seguro reenviar com a mesma ref — o Focus deduplica por referência.
    await supabase
      .from("notas_fiscais")
      .update({ status: "rascunho", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "processando");
    revalidatePath(PATH);
    return { ok: false, mensagem: e instanceof Error ? e.message : "Falha ao enviar a nota." };
  }

  // Engine SEFAZ: guarda o XML autorizado e a DANFE (vêm em base64) no Storage e
  // usa as URLs assinadas. Falha aqui NÃO reprova a nota (já autorizada na SEFAZ).
  let danfeUrl = resultado.danfeUrl;
  let xmlUrl = resultado.xmlUrl;
  if (motorAtivo === "sefaz" && resultado.status === "autorizada") {
    const nomeArq = resultado.chave || nota.ref;
    try {
      if (resultado.xmlBase64) {
        xmlUrl = await guardarArquivoSefaz(supabase, empresaUserId, nomeArq, "xml", resultado.xmlBase64, "application/xml");
      }
      if (resultado.danfeBase64) {
        danfeUrl = await guardarArquivoSefaz(supabase, empresaUserId, nomeArq, "pdf", resultado.danfeBase64, "application/pdf");
      }
    } catch {
      /* guarda falhou — nota segue autorizada; URLs ficam vazias (recuperável depois) */
    }
  }

  const { error } = await supabase
    .from("notas_fiscais")
    .update({
      status: resultado.status,
      numero: resultado.numero,
      serie: resultado.serie,
      motivo_rejeicao: resultado.motivo,
      danfe_url: danfeUrl,
      xml_url: xmlUrl,
      chave: resultado.chave ?? "",
      protocolo: resultado.protocolo ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, mensagem: error.message };

  // Anexa automaticamente no acervo do cliente quando autorizada (não-fatal).
  if (resultado.status === "autorizada") {
    try {
      await anexarNotaNoAcervo(supabase, user.id, {
        id,
        numero: resultado.numero,
        cliente_id: nota.cliente_id,
        contratacao_id: nota.contratacao_id,
        danfe_url: danfeUrl,
        xml_url: xmlUrl,
      });
    } catch {
      /* anexo automático não reprova a emissão; pode-se anexar manualmente depois */
    }
  }

  revalidatePath(PATH);
  return resultado.status === "rejeitada"
    ? { ok: false, mensagem: resultado.motivo || "Nota rejeitada pela SEFAZ." }
    : { ok: true };
}

export async function consultarStatusNotaFiscal(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("ref, status, chave, protocolo")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "processando") {
    throw new Error("Só é possível atualizar notas em processamento.");
  }

  const resultado = await consultarNFe({
    ref: nota.ref,
    chave: nota.chave ?? "",
    protocolo: nota.protocolo ?? "",
  });
  const { error } = await supabase
    .from("notas_fiscais")
    .update({
      status: resultado.status,
      numero: resultado.numero,
      serie: resultado.serie,
      motivo_rejeicao: resultado.motivo,
      danfe_url: resultado.danfeUrl,
      xml_url: resultado.xmlUrl,
      chave: resultado.chave ?? "",
      protocolo: resultado.protocolo ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  // Anexo automático quando a consulta resolve para autorizada (não-fatal).
  if (resultado.status === "autorizada") {
    try {
      const { data: n2 } = await supabase
        .from("notas_fiscais")
        .select("id, numero, cliente_id, contratacao_id, danfe_url, xml_url")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (n2) await anexarNotaNoAcervo(supabase, user.id, n2);
    } catch {
      /* anexo automático não-fatal */
    }
  }

  revalidatePath(PATH);
}

/**
 * Baixa DANFE/XML e anexa como documentos no acervo do CLIENTE (e da contratação,
 * se houver). Idempotente via `anexada_em`. Não exige contratação — uma nota só
 * vinculada a cliente é anexada no nível do cliente. Sem cliente, não faz nada.
 */
async function anexarNotaNoAcervo(
  supabase: ServerClient,
  userId: string,
  nota: {
    id: string;
    numero: string;
    cliente_id: string | null;
    contratacao_id: string | null;
    danfe_url: string;
    xml_url: string;
  },
): Promise<void> {
  // Cliente: pela contratação (autoritativo) ou direto do vínculo da nota.
  let clienteId = nota.cliente_id;
  if (nota.contratacao_id) {
    const { data: ct } = await supabase
      .from("contratacoes")
      .select("cliente_id")
      .eq("id", nota.contratacao_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (ct?.cliente_id) clienteId = ct.cliente_id as string;
  }
  if (!clienteId) return; // sem cliente vinculado — nada a anexar

  const arquivos = [
    nota.danfe_url ? { url: nota.danfe_url, ext: "pdf", rotulo: "DANFE" } : null,
    nota.xml_url ? { url: nota.xml_url, ext: "xml", rotulo: "XML" } : null,
  ].filter((a): a is { url: string; ext: string; rotulo: string } => a !== null);
  if (arquivos.length === 0) return;

  // Claim idempotente: só a primeira execução anexa (evita duplicar em retrigger).
  const { data: claim } = await supabase
    .from("notas_fiscais")
    .update({ anexada_em: new Date().toISOString() })
    .eq("id", nota.id)
    .eq("user_id", userId)
    .is("anexada_em", null)
    .select("id");
  if (!claim || claim.length === 0) return; // já anexada

  const empresaUserId = await resolverEmpresaUserId(supabase, userId);
  const numero = nota.numero || "sn";
  const criados: { path: string; rowId: string }[] = [];
  try {
    for (const arq of arquivos) {
      const { conteudo, contentType } = await baixarArquivo(arq.url);
      const docId = crypto.randomUUID();
      const nomeArquivo = `nf-${numero}-${arq.rotulo.toLowerCase()}.${arq.ext}`;
      const path = `${empresaUserId}/clientes/${clienteId}/${docId}/${nomeArquivo}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, conteudo, { contentType, upsert: false });
      if (upErr) throw new Error(`Falha no upload do ${arq.rotulo}: ${upErr.message}`);

      const { data: doc, error: insErr } = await supabase
        .from("cliente_documentos")
        .insert({
          cliente_id: clienteId,
          contratacao_id: nota.contratacao_id,
          user_id: userId,
          tipo: "nota_fiscal",
          nome: `${arq.rotulo} NF ${numero}`,
          arquivo_path: path,
          arquivo_nome: nomeArquivo,
        })
        .select("id")
        .single();
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(insErr.message);
      }
      criados.push({ path, rowId: doc.id as string });
    }
  } catch (e) {
    // Rollback do parcial e libera o claim para permitir nova tentativa limpa.
    for (const c of criados) {
      await supabase.from("cliente_documentos").delete().eq("id", c.rowId).eq("user_id", userId);
      await supabase.storage.from(BUCKET).remove([c.path]);
    }
    await supabase
      .from("notas_fiscais")
      .update({ anexada_em: null })
      .eq("id", nota.id)
      .eq("user_id", userId);
    throw e instanceof Error ? e : new Error("Falha ao anexar a nota.");
  }

  if (nota.contratacao_id) {
    revalidatePath(`/vital-norte/clientes/${clienteId}/contratacao/${nota.contratacao_id}`);
  }
  revalidatePath(`/vital-norte/clientes/${clienteId}`);
  revalidatePath(PATH);
}

/** Anexa manualmente uma nota autorizada ao acervo do cliente (fallback do automático). */
export async function anexarNotaNaContratacao(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("id, numero, cliente_id, contratacao_id, danfe_url, xml_url, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "autorizada") throw new Error("Apenas notas autorizadas podem ser anexadas.");
  if (!nota.cliente_id && !nota.contratacao_id) {
    throw new Error("Vincule a nota a um cliente para anexar.");
  }
  await anexarNotaNoAcervo(supabase, user.id, nota);
}

export async function cancelarNotaFiscal(id: string, justificativa: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const just = (justificativa ?? "").trim();
  if (just.length < 15) throw new Error("A justificativa deve ter ao menos 15 caracteres.");
  if (just.length > 255) throw new Error("A justificativa deve ter no máximo 255 caracteres.");

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("ref, status, chave, protocolo")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "autorizada") throw new Error("Apenas notas autorizadas podem ser canceladas.");

  // "cancelada" se confirmado na hora; "processando" se assíncrono (reconcilia via consulta/webhook).
  const novoStatus = await cancelarNFe(
    { ref: nota.ref, chave: nota.chave ?? "", protocolo: nota.protocolo ?? "" },
    just,
  );

  const { error } = await supabase
    .from("notas_fiscais")
    .update({
      status: novoStatus,
      cancelamento_justificativa: just,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "autorizada");
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function cartaCorrecaoNotaFiscal(id: string, correcao: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const txt = (correcao ?? "").trim();
  if (txt.length < 15) throw new Error("A correção deve ter ao menos 15 caracteres.");
  if (txt.length > 1000) throw new Error("A correção deve ter no máximo 1000 caracteres.");

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("ref, status, chave, protocolo, cartas_correcao")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "autorizada") {
    throw new Error("Apenas notas autorizadas aceitam carta de correção.");
  }

  const { ccePdfUrl } = await cartaCorrecaoNFe(
    { ref: nota.ref, chave: nota.chave ?? "", protocolo: nota.protocolo ?? "" },
    txt,
  );

  // Acumula o histórico de CC-e (a SEFAZ mantém todas as correções sequenciais).
  const historico = Array.isArray(nota.cartas_correcao) ? nota.cartas_correcao : [];
  const atualizado = [...historico, { correcao: txt, cce_url: ccePdfUrl, em: new Date().toISOString() }];

  // A CC-e não altera o status da nota (permanece autorizada).
  const { error } = await supabase
    .from("notas_fiscais")
    .update({ cartas_correcao: atualizado, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "autorizada");
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function removerNotaFiscal(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status === "autorizada" || nota.status === "processando") {
    throw new Error("Não é possível remover uma nota autorizada ou em processamento.");
  }

  const { error } = await supabase
    .from("notas_fiscais")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}
