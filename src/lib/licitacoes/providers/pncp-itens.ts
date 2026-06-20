import { LicitacaoItem } from "../types";

const PNCP_API = "https://pncp.gov.br/api/pncp/v1";

interface NumeroControle {
  cnpj: string;
  ano: string;
  sequencial: string;
}

/** Decompõe um numeroControlePNCP no formato "CNPJ-1-SEQUENCIAL/ANO". */
export function parseNumeroControle(numeroControlePNCP: string): NumeroControle | null {
  const m = numeroControlePNCP.match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  if (!m) return null;
  const [, cnpj, sequencial, ano] = m;
  return { cnpj, ano, sequencial: String(Number(sequencial)) };
}

interface PncpItemBruto {
  numeroItem: number;
  descricao: string;
  quantidade: number | null;
  unidadeMedida: string | null;
  valorUnitarioEstimado: number | null;
  valorTotal: number | null;
}

/** Busca os itens de uma contratação a partir do seu numeroControlePNCP. */
export async function buscarItensPncp(numeroControlePNCP: string): Promise<LicitacaoItem[]> {
  const ref = parseNumeroControle(numeroControlePNCP);
  if (!ref) return [];

  const url = `${PNCP_API}/orgaos/${ref.cnpj}/compras/${ref.ano}/${ref.sequencial}/itens`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) return [];

  const itens = (await res.json()) as PncpItemBruto[];
  return itens.map((item) => ({
    numeroItem: item.numeroItem,
    descricao: item.descricao ?? "",
    quantidade: item.quantidade ?? null,
    unidadeMedida: item.unidadeMedida ?? "",
    valorUnitarioEstimado: item.valorUnitarioEstimado ?? null,
    valorTotal: item.valorTotal ?? null,
  }));
}
