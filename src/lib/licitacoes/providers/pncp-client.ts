import { MODALIDADES, UnifiedLicitacao, UniversalFilter } from "../types";

const BASE_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
const PAGE_SIZE = 50;
const MAX_PAGES_PER_CALL = 2;
const DEFAULT_MODALIDADES = [4, 5, 6, 7, 8, 9];

interface PncpOrgaoEntidade {
  cnpj: string;
  razaoSocial: string;
  poderId: string;
  esferaId: string;
}

interface PncpUnidadeOrgao {
  ufNome: string;
  ufSigla: string;
  municipioNome: string;
  codigoIbge: string;
}

interface PncpItem {
  numeroControlePNCP: string;
  objetoCompra: string;
  informacaoComplementar: string | null;
  orgaoEntidade: PncpOrgaoEntidade;
  unidadeOrgao: PncpUnidadeOrgao;
  modalidadeNome: string;
  situacaoCompraNome: string;
  valorTotalEstimado: number | null;
  dataPublicacaoPncp: string | null;
  dataAberturaProposta: string | null;
  dataEncerramentoProposta: string | null;
  linkSistemaOrigem: string | null;
}

interface PncpResponse {
  data: PncpItem[];
  totalRegistros: number;
  totalPaginas: number;
}

function toYyyymmdd(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function mapItem(item: PncpItem): UnifiedLicitacao {
  return {
    id: item.numeroControlePNCP,
    plataforma: "pncp",
    numeroControlePNCP: item.numeroControlePNCP,
    titulo: item.objetoCompra?.slice(0, 140) ?? "",
    descricao: item.objetoCompra ?? "",
    orgao: item.orgaoEntidade?.razaoSocial ?? "",
    esfera: item.orgaoEntidade?.esferaId ?? "",
    uf: item.unidadeOrgao?.ufSigla ?? "",
    municipio: item.unidadeOrgao?.municipioNome ?? "",
    modalidade: item.modalidadeNome ?? "",
    situacao: item.situacaoCompraNome ?? "",
    valorEstimado: item.valorTotalEstimado ?? null,
    dataPublicacao: item.dataPublicacaoPncp ?? null,
    dataAberturaProposta: item.dataAberturaProposta ?? null,
    dataEncerramentoProposta: item.dataEncerramentoProposta ?? null,
    linkOrigem: item.linkSistemaOrigem ?? null,
  };
}

async function buscarPagina(params: URLSearchParams): Promise<PncpResponse> {
  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 204) {
    return { data: [], totalRegistros: 0, totalPaginas: 0 };
  }
  if (!res.ok) {
    throw new Error(`PNCP respondeu ${res.status} para ${params.toString()}`);
  }
  return res.json();
}

async function buscarModalidadeUf(
  filtro: UniversalFilter,
  modalidadeId: number,
  uf?: string,
): Promise<PncpItem[]> {
  const itens: PncpItem[] = [];
  for (let pagina = 1; pagina <= MAX_PAGES_PER_CALL; pagina++) {
    const params = new URLSearchParams({
      dataInicial: toYyyymmdd(filtro.dataInicial),
      dataFinal: toYyyymmdd(filtro.dataFinal),
      codigoModalidadeContratacao: String(modalidadeId),
      pagina: String(pagina),
      tamanhoPagina: String(PAGE_SIZE),
    });
    if (uf) params.set("uf", uf);

    const resposta = await buscarPagina(params);
    itens.push(...resposta.data);
    if (pagina >= resposta.totalPaginas) break;
  }
  return itens;
}

export async function buscarPncp(filtro: UniversalFilter): Promise<UnifiedLicitacao[]> {
  const modalidades =
    filtro.modalidades && filtro.modalidades.length > 0
      ? filtro.modalidades
      : DEFAULT_MODALIDADES;
  const ufs = filtro.ufs && filtro.ufs.length > 0 ? filtro.ufs : [undefined];

  const combinacoes = modalidades.flatMap((modalidadeId) =>
    ufs.map((uf) => ({ modalidadeId, uf })),
  );

  const resultados = await Promise.all(
    combinacoes.map(({ modalidadeId, uf }) =>
      buscarModalidadeUf(filtro, modalidadeId, uf).catch(() => [] as PncpItem[]),
    ),
  );

  const vistos = new Set<string>();
  const itens: PncpItem[] = [];
  for (const lista of resultados) {
    for (const item of lista) {
      if (vistos.has(item.numeroControlePNCP)) continue;
      vistos.add(item.numeroControlePNCP);
      itens.push(item);
    }
  }

  const keyword = filtro.keyword?.trim().toLowerCase();
  const orgaoFiltro = filtro.orgao?.trim().toLowerCase();

  return itens
    .filter((item) => {
      if (keyword) {
        const alvo = `${item.objetoCompra ?? ""} ${item.informacaoComplementar ?? ""}`.toLowerCase();
        if (!alvo.includes(keyword)) return false;
      }
      if (orgaoFiltro) {
        if (!item.orgaoEntidade?.razaoSocial?.toLowerCase().includes(orgaoFiltro)) return false;
      }
      if (filtro.valorMin != null && (item.valorTotalEstimado ?? 0) < filtro.valorMin) return false;
      if (filtro.valorMax != null && (item.valorTotalEstimado ?? Infinity) > filtro.valorMax) return false;
      return true;
    })
    .map(mapItem);
}

export function nomeModalidade(id: number): string {
  return MODALIDADES.find((m) => m.id === id)?.nome ?? String(id);
}
