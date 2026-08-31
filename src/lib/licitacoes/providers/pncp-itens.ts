import { LicitacaoItem, ResultadoBusca, UnifiedLicitacao } from "../types";

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

function mapCompra(compra: PncpCompraBruta): UnifiedLicitacao {
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

type ResultadoCompra =
  | { status: "ok"; licitacao: UnifiedLicitacao }
  | { status: "nao_encontrada" }
  | { status: "erro" };

/**
 * Busca o detalhe de uma contratação pelo numeroControlePNCP, distinguindo
 * "não existe" (404) de "PNCP fora do ar" (timeout/rede/5xx). O endpoint de
 * detalhe do PNCP é instável e às vezes expira: re-tentamos algumas vezes com
 * timeout curto antes de desistir.
 */
async function buscarCompraPncpDetalhado(
  numeroControlePNCP: string,
  tentativas = 3,
): Promise<ResultadoCompra> {
  const ref = parseNumeroControle(numeroControlePNCP);
  if (!ref) return { status: "nao_encontrada" };

  // O detalhe da compra foi movido para a API de consulta (/api/consulta/v1)
  const url = `https://pncp.gov.br/api/consulta/v1/orgaos/${ref.cnpj}/compras/${ref.ano}/${ref.sequencial}`;
  for (let i = 0; i < tentativas; i++) {
    // Backoff entre tentativas: o PNCP costuma responder 502/503 quando
    // sobrecarregado, e insistir rápido demais vira 429 (rate-limit).
    if (i > 0) await new Promise((r) => setTimeout(r, 600 * i));
    try {
      const resposta = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (resposta.status === 404) return { status: "nao_encontrada" };
      if (!resposta.ok) continue; // 5xx/301/429 transitório → tenta de novo
      const compra = (await resposta.json()) as PncpCompraBruta;
      return { status: "ok", licitacao: mapCompra(compra) };
    } catch {
      // timeout/rede → tenta de novo
    }
  }
  return { status: "erro" };
}

/** Busca os dados de uma contratação (perfil) a partir do numeroControlePNCP. */
export async function buscarCompraPncp(numeroControlePNCP: string): Promise<UnifiedLicitacao | null> {
  const r = await buscarCompraPncpDetalhado(numeroControlePNCP);
  return r.status === "ok" ? r.licitacao : null;
}

/**
 * Versão da busca por número de controle no formato de resultado da busca.
 * `incompleto: true` sinaliza PNCP fora do ar (para a UI oferecer "tente
 * novamente"); lista vazia sem `incompleto` significa que não existe.
 */
export async function buscarLicitacaoPorNumeroControle(
  numeroControlePNCP: string,
): Promise<ResultadoBusca> {
  const r = await buscarCompraPncpDetalhado(numeroControlePNCP);
  if (r.status === "ok") return { itens: [r.licitacao], totalPaginas: 1, totalRegistros: 1 };
  if (r.status === "nao_encontrada") return { itens: [], totalPaginas: 0, totalRegistros: 0 };
  return { itens: [], totalPaginas: 0, totalRegistros: 0, incompleto: true };
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
  tipoBeneficioNome: string | null;
  catalogoCodigoItem: string | number | null;
  informacaoComplementar: string | null;
  temResultado?: boolean;
}

interface PncpResultadoBruto {
  marca?: string | null;
  marcaFabricante?: string | null;
  descricaoMarca?: string | null;
}

function mapearItem(item: PncpItemBruto): LicitacaoItem {
  return {
    numeroItem: item.numeroItem,
    descricao: item.descricao ?? "",
    quantidade: item.quantidade ?? null,
    unidadeMedida: item.unidadeMedida ?? "",
    valorUnitarioEstimado: item.valorUnitarioEstimado ?? null,
    valorTotal: item.valorTotal ?? null,
    tipoBeneficioNome: item.tipoBeneficioNome ?? "",
    codigoCatalogo: item.catalogoCodigoItem != null ? String(item.catalogoCodigoItem) : "",
    descricaoCompleta: item.informacaoComplementar ?? "",
    marcas: "", // preenchido depois, a partir dos resultados (quando o item tem resultado)
  };
}

/** Busca as marcas dos resultados de um item (só existem após o certame ter resultado). */
async function buscarMarcasItem(ref: NumeroControle, numeroItem: number): Promise<string> {
  try {
    const url = `${PNCP_API}/orgaos/${ref.cnpj}/compras/${ref.ano}/${ref.sequencial}/itens/${numeroItem}/resultados`;
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return "";
    const resultados = (await res.json()) as PncpResultadoBruto[];
    if (!Array.isArray(resultados)) return "";
    const marcas = resultados
      .map((r) => (r.marca ?? r.marcaFabricante ?? r.descricaoMarca ?? "").trim())
      .filter(Boolean);
    return [...new Set(marcas)].join(", ");
  } catch {
    return "";
  }
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
  const brutos: PncpItemBruto[] = [];

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
    brutos.push(...lote);
    if (lote.length < TAMANHO_PAGINA) break; // última página
  }

  const itens = brutos.map(mapearItem);
  // Marcas vêm dos resultados do item — só buscamos para os que já têm resultado
  // (licitação aberta = nenhum resultado = nenhuma chamada extra).
  await Promise.all(
    itens.map(async (item, i) => {
      if (brutos[i].temResultado) item.marcas = await buscarMarcasItem(ref, item.numeroItem);
    }),
  );

  return itens;
}
