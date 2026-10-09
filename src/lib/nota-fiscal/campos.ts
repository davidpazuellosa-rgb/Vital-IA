import { calcularTotalItens, type NotaFiscalItem } from "./types";

/* Leitura e VALIDAÇÃO dos campos de uma nota (sem acesso ao banco). Usado pela tela de Nota Fiscal
 * e pela Vita (rascunhos), para as duas aplicarem exatamente as mesmas regras. */

export const apenasDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export function parseItens(raw: string): NotaFiscalItem[] {
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

export type CamposNota = {
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
export function lerCamposNota(formData: FormData): CamposNota {
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

/** Colunas da nota a partir dos campos validados (compartilhado entre insert e update). */
export function colunasNota(c: CamposNota) {
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
