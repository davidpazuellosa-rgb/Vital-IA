import { LicitacaoItem, UnifiedLicitacao } from "../types";

const PNCP_API = "https://pncp.gov.br/api/pncp/v1";

interface PncpCompraBruta {
  numeroControlePNCP: string;
  objetoCompra: string | null;
  orgaoEntidade?: { razaoSocial?: string | null; esferaId?: string | null } | null;
  unidadeOrgao?: { ufSigla?: string | null; municipioNome?: string | null } | null;
  modalidadeNome: string | null;
  situacaoCompraNome: string | null;
  valorTotalEstimado: number | null;
  dataPublicacaoPncp: string | null;
  dataAberturaProposta: string | null;
  dataEncerramentoProposta: string | null;
  linkSistemaOrigem: string | null;
}

/** Busca os dados de uma contratação (perfil) a partir do numeroControlePNCP. */
export async function buscarCompraPncp(numeroControlePNCP: string): Promise<UnifiedLicitacao | null> {
  const ref = parseNumeroControle(numeroControlePNCP);
  if (!ref) return null;

  // O detalhe da compra foi movido para a API de consulta (/api/consulta/v1)
  const url = `https://pncp.gov.br/api/consulta/v1/orgaos/${ref.cnpj}/compras/${ref.ano}/${ref.sequencial}`;
  let compra: PncpCompraBruta;
  try {
    const resposta = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!resposta.ok) return null;
    compra = (await resposta.json()) as PncpCompraBruta;
  } catch {
    return null;
  }

  const objeto = compra.objetoCompra ?? "";
  return {
    id: compra.numeroControlePNCP,
    plataforma: "pncp",
    numeroControlePNCP: compra.numeroControlePNCP,
    titulo: objeto.slice(0, 140),
    descricao: objeto,
    orgao: compra.orgaoEntidade?.razaoSocial ?? "",
    esfera: compra.orgaoEntidade?.esferaId ?? "",
    uf: compra.unidadeOrgao?.ufSigla ?? "",
    municipio: compra.unidadeOrgao?.municipioNome ?? "",
    modalidade: compra.modalidadeNome ?? "",
    situacao: compra.situacaoCompraNome ?? "",
    valorEstimado: compra.valorTotalEstimado ?? null,
    dataPublicacao: compra.dataPublicacaoPncp ?? null,
    dataAberturaProposta: compra.dataAberturaProposta ?? null,
    dataEncerramentoProposta: compra.dataEncerramentoProposta ?? null,
    linkOrigem: compra.linkSistemaOrigem ?? null,
  };
}

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

function mapearItem(item: PncpItemBruto): LicitacaoItem {
  return {
    numeroItem: item.numeroItem,
    descricao: item.descricao ?? "",
    quantidade: item.quantidade ?? null,
    unidadeMedida: item.unidadeMedida ?? "",
    valorUnitarioEstimado: item.valorUnitarioEstimado ?? null,
    valorTotal: item.valorTotal ?? null,
  };
}

/**
 * Busca TODOS os itens de uma contratação a partir do seu numeroControlePNCP.
 *
 * A API de itens do PNCP é paginada e devolve só 10 por padrão (sem cabeçalho de
 * total), então percorremos as páginas até uma vir incompleta/vazia. Antes o app
 * mostrava apenas os 10 primeiros itens.
 */
export async function buscarItensPncp(numeroControlePNCP: string): Promise<LicitacaoItem[]> {
  const ref = parseNumeroControle(numeroControlePNCP);
  if (!ref) return [];

  const base = `${PNCP_API}/orgaos/${ref.cnpj}/compras/${ref.ano}/${ref.sequencial}/itens`;
  const TAMANHO_PAGINA = 50;
  const MAX_PAGINAS = 60; // trava de segurança (até 3000 itens)
  const todos: LicitacaoItem[] = [];

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    let lote: PncpItemBruto[];
    try {
      const res = await fetch(`${base}?pagina=${pagina}&tamanhoPagina=${TAMANHO_PAGINA}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) break;
      lote = (await res.json()) as PncpItemBruto[];
    } catch {
      break;
    }
    if (!Array.isArray(lote) || lote.length === 0) break;
    todos.push(...lote.map(mapearItem));
    if (lote.length < TAMANHO_PAGINA) break; // última página
  }

  return todos;
}
