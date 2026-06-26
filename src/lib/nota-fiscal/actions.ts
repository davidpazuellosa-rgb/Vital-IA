"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { baixarArquivo, cancelarNFe, cartaCorrecaoNFe, consultarNFe, emitirNFe } from "./focus";
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
    uf: txt(dados.uf).toUpperCase().slice(0, 2),
  };
}

type EmpresaEmitente = {
  cnpj: string;
  inscricao_estadual: string;
};

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
    })
    .filter((i) => i.descricao && i.quantidade > 0);
  if (itens.length === 0) {
    throw new Error("Adicione ao menos um item com descrição e quantidade.");
  }
  return itens;
}

export async function criarNotaFiscal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const clienteId = ((formData.get("clienteId") as string) ?? "").trim() || null;
  const contratacaoId = ((formData.get("contratacaoId") as string) ?? "").trim() || null;
  const naturezaOperacao =
    ((formData.get("naturezaOperacao") as string) ?? "").trim() || "Venda de mercadoria";
  const observacoes = ((formData.get("observacoes") as string) ?? "").trim();

  const destinatarioNome = ((formData.get("destinatarioNome") as string) ?? "").trim();
  const destinatarioDocumento = apenasDigitos(formData.get("destinatarioDocumento") as string);
  if (!destinatarioNome) throw new Error("Informe o nome do destinatário.");
  if (destinatarioDocumento.length !== 14 && destinatarioDocumento.length !== 11) {
    throw new Error("CNPJ (14 dígitos) ou CPF (11 dígitos) do destinatário inválido.");
  }

  const itens = parseItens((formData.get("itens") as string) ?? "[]");
  const valorTotal = calcularTotalItens(itens);

  // Confere pertencimento do cliente/contratação (a RLS já protege; aqui damos erro amigável).
  if (clienteId) {
    const { data: cli } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!cli) throw new Error("Cliente inválido.");
  }
  if (contratacaoId) {
    const { data: ctr } = await supabase
      .from("contratacoes")
      .select("id")
      .eq("id", contratacaoId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ctr) throw new Error("Contratação inválida.");
  }

  const ref = "nf-" + crypto.randomUUID();
  const { data, error } = await supabase
    .from("notas_fiscais")
    .insert({
      user_id: user.id,
      cliente_id: clienteId,
      contratacao_id: contratacaoId,
      ref,
      natureza_operacao: naturezaOperacao,
      observacoes,
      destinatario_nome: destinatarioNome,
      destinatario_documento: destinatarioDocumento,
      destinatario_ie: ((formData.get("destinatarioIe") as string) ?? "").trim(),
      destinatario_cep: apenasDigitos(formData.get("destinatarioCep") as string),
      destinatario_logradouro: ((formData.get("destinatarioLogradouro") as string) ?? "").trim(),
      destinatario_numero: ((formData.get("destinatarioNumero") as string) ?? "").trim(),
      destinatario_bairro: ((formData.get("destinatarioBairro") as string) ?? "").trim(),
      destinatario_municipio: ((formData.get("destinatarioMunicipio") as string) ?? "").trim(),
      destinatario_uf: ((formData.get("destinatarioUf") as string) ?? "").trim().toUpperCase().slice(0, 2),
      valor_total: valorTotal,
      itens,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
  return data.id as string;
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
  // Contribuinte de ICMS quando há inscrição estadual; órgão público costuma ser isento.
  const contribuinte = Boolean(nota.destinatario_ie?.trim());
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
    indicador_inscricao_estadual_destinatario: contribuinte ? 1 : 9,
    inscricao_estadual_destinatario: contribuinte ? nota.destinatario_ie : undefined,
    logradouro_destinatario: nota.destinatario_logradouro,
    numero_destinatario: nota.destinatario_numero,
    bairro_destinatario: nota.destinatario_bairro,
    municipio_destinatario: nota.destinatario_municipio,
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

export async function emitirNotaFiscal(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "rascunho") throw new Error("Esta nota já foi enviada.");

  // Emitente vem de public.empresa (acervo compartilhado da empresa).
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);
  const { data: empresa } = await supabase
    .from("empresa")
    .select("cnpj, inscricao_estadual")
    .eq("user_id", empresaUserId)
    .maybeSingle();
  if (!empresa?.cnpj) {
    throw new Error("Cadastre o CNPJ em Dados da Empresa antes de emitir.");
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
    throw new Error("Esta nota já está sendo processada.");
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
    throw new Error(e instanceof Error ? e.message : "Falha ao enviar a nota.");
  }

  const { error } = await supabase
    .from("notas_fiscais")
    .update({
      status: resultado.status,
      numero: resultado.numero,
      serie: resultado.serie,
      motivo_rejeicao: resultado.motivo,
      danfe_url: resultado.danfeUrl,
      xml_url: resultado.xmlUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

export async function consultarStatusNotaFiscal(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("ref, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "processando") {
    throw new Error("Só é possível atualizar notas em processamento.");
  }

  const resultado = await consultarNFe(nota.ref);
  const { error } = await supabase
    .from("notas_fiscais")
    .update({
      status: resultado.status,
      numero: resultado.numero,
      serie: resultado.serie,
      motivo_rejeicao: resultado.motivo,
      danfe_url: resultado.danfeUrl,
      xml_url: resultado.xmlUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(PATH);
}

/** Baixa DANFE e XML do provedor e anexa como documentos da contratação vinculada. */
export async function anexarNotaNaContratacao(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: nota } = await supabase
    .from("notas_fiscais")
    .select("status, numero, contratacao_id, danfe_url, xml_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "autorizada") throw new Error("Apenas notas autorizadas podem ser anexadas.");
  if (!nota.contratacao_id) throw new Error("Vincule a nota a uma contratação primeiro.");

  // cliente_id autoritativo a partir da contratação (não confia no campo da nota).
  const { data: contratacao } = await supabase
    .from("contratacoes")
    .select("id, cliente_id")
    .eq("id", nota.contratacao_id)
    .eq("user_id", user.id)
    .single();
  if (!contratacao) throw new Error("Contratação não encontrada.");
  const clienteId = contratacao.cliente_id as string;

  const numero = nota.numero || "sn";
  const arquivos = [
    nota.danfe_url ? { url: nota.danfe_url, ext: "pdf", rotulo: "DANFE" } : null,
    nota.xml_url ? { url: nota.xml_url, ext: "xml", rotulo: "XML" } : null,
  ].filter((a): a is { url: string; ext: string; rotulo: string } => a !== null);
  if (arquivos.length === 0) throw new Error("Nota sem DANFE/XML disponível.");

  // Claim idempotente: só a primeira execução prossegue (evita duplicar em clique/retry).
  const { data: claim } = await supabase
    .from("notas_fiscais")
    .update({ anexada_em: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("anexada_em", null)
    .select("id");
  if (!claim || claim.length === 0) {
    throw new Error("Esta nota já foi anexada à contratação.");
  }

  // O prefixo do storage precisa ser o id da empresa (RLS do bucket "documentos").
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);
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
          user_id: user.id,
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
      await supabase.from("cliente_documentos").delete().eq("id", c.rowId).eq("user_id", user.id);
      await supabase.storage.from(BUCKET).remove([c.path]);
    }
    await supabase
      .from("notas_fiscais")
      .update({ anexada_em: null })
      .eq("id", id)
      .eq("user_id", user.id);
    throw e instanceof Error ? e : new Error("Falha ao anexar a nota.");
  }

  revalidatePath(`/vital-norte/clientes/${clienteId}/contratacao/${nota.contratacao_id}`);
  revalidatePath(PATH);
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
    .select("ref, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "autorizada") throw new Error("Apenas notas autorizadas podem ser canceladas.");

  // "cancelada" se confirmado na hora; "processando" se assíncrono (reconcilia via consulta/webhook).
  const novoStatus = await cancelarNFe(nota.ref, just);

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
    .select("ref, status, cartas_correcao")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!nota) throw new Error("Nota não encontrada.");
  if (nota.status !== "autorizada") {
    throw new Error("Apenas notas autorizadas aceitam carta de correção.");
  }

  const { ccePdfUrl } = await cartaCorrecaoNFe(nota.ref, txt);

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
