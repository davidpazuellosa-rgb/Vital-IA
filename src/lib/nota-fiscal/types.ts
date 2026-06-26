export type NotaFiscalStatus =
  | "rascunho"
  | "processando"
  | "autorizada"
  | "rejeitada"
  | "cancelada";

/**
 * Resultado de emissão/consulta, neutro de provedor. Tanto a engine Focus
 * (`focus.ts`) quanto a engine direta SEFAZ (`sefaz.ts`) retornam esta forma,
 * para que o app não dependa de qual motor está ativo (ver `engine.ts`).
 */
export type ResultadoEmissao = {
  status: NotaFiscalStatus;
  numero: string;
  serie: string;
  motivo: string;
  danfeUrl: string;
  xmlUrl: string;
  // Preenchidos só pela engine direta SEFAZ (sefaz.ts); vazios no Focus.
  chave?: string;
  protocolo?: string;
  xmlBase64?: string; // XML autorizado (nfeProc) para o app guardar (5 anos)
};

export type NotaFiscalItem = {
  descricao: string;
  ncm: string; // código NCM (8 dígitos)
  cfop: string; // ex.: 5101
  unidade: string; // ex.: KG
  quantidade: number;
  valor_unitario: number;
};

export type NotaFiscal = {
  id: string;
  user_id: string;
  cliente_id: string | null;
  contratacao_id: string | null;
  ref: string;
  natureza_operacao: string;
  status: NotaFiscalStatus;
  numero: string;
  serie: string;
  motivo_rejeicao: string;
  valor_total: number;
  itens: NotaFiscalItem[];
  observacoes: string;
  destinatario_nome: string;
  destinatario_documento: string;
  destinatario_ie: string;
  destinatario_cep: string;
  destinatario_logradouro: string;
  destinatario_numero: string;
  destinatario_bairro: string;
  destinatario_municipio: string;
  destinatario_codigo_municipio: string; // IBGE 7 díg. (cMun) — usado na engine SEFAZ
  destinatario_uf: string;
  chave: string; // chave de acesso (44 díg.) — preenchida na engine SEFAZ
  protocolo: string; // protocolo de autorização — usado p/ cancelar na engine SEFAZ
  danfe_url: string;
  xml_url: string;
  anexada_em: string | null;
  cancelamento_justificativa: string;
  cartas_correcao: CartaCorrecao[];
  created_at: string;
};

export type CartaCorrecao = {
  correcao: string;
  cce_url: string;
  em: string;
};

export const NOTA_FISCAL_STATUS_LABEL: Record<NotaFiscalStatus, string> = {
  rascunho: "Rascunho",
  processando: "Processando",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
};

/** Variante do componente Badge usada por status. */
export const NOTA_FISCAL_STATUS_VARIANT: Record<
  NotaFiscalStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  rascunho: "secondary",
  processando: "outline",
  autorizada: "default",
  rejeitada: "destructive",
  cancelada: "outline",
};

/** Valor bruto de um item, arredondado a 2 casas (igual ao enviado à SEFAZ). */
export function valorLinha(item: Pick<NotaFiscalItem, "quantidade" | "valor_unitario">): number {
  const bruto = (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0);
  return Number(bruto.toFixed(2));
}

export function calcularTotalItens(itens: NotaFiscalItem[]): number {
  return Number(itens.reduce((soma, item) => soma + valorLinha(item), 0).toFixed(2));
}
