import {
  MODALIDADES,
  Paginacao,
  ResultadoBusca,
  UnifiedLicitacao,
  UniversalFilter,
} from "../types";

const PUBLICACAO_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
const PROPOSTA_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
const DEFAULT_MODALIDADES = [4, 5, 6, 7, 8, 9];

/** Data limite (AAAAMMDD) de encerramento de propostas para o modo "em aberto": hoje + 1 ano. */
function horizonteEncerramento(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return toYyyymmdd(d.toISOString().slice(0, 10));
}

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

async function buscarPagina(baseUrl: string, params: URLSearchParams): Promise<PncpResponse> {
  // Timeout para o PNCP não pendurar a busca quando estiver lento/instável.
  const res = await fetch(`${baseUrl}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 204) {
    return { data: [], totalRegistros: 0, totalPaginas: 0 };
  }
  if (!res.ok) {
    throw new Error(`PNCP respondeu ${res.status} para ${params.toString()}`);
  }
  return res.json();
}

interface PaginaCombo {
  itens: PncpItem[];
  totalPaginas: number;
  totalRegistros: number;
}

async function buscarCombo(
  filtro: UniversalFilter,
  apenasAberto: boolean,
  paginacao: Paginacao,
  modalidadeId: number | undefined,
  uf: string | undefined,
): Promise<PaginaCombo> {
  const baseUrl = apenasAberto ? PROPOSTA_URL : PUBLICACAO_URL;
  const params = new URLSearchParams({
    pagina: String(paginacao.pagina),
    tamanhoPagina: String(paginacao.tamanhoPagina),
  });
  if (modalidadeId != null) {
    params.set("codigoModalidadeContratacao", String(modalidadeId));
  }
  if (apenasAberto) {
    params.set("dataFinal", horizonteEncerramento());
  } else {
    params.set("dataInicial", toYyyymmdd(filtro.dataInicial));
    params.set("dataFinal", toYyyymmdd(filtro.dataFinal));
  }
  if (uf) params.set("uf", uf);

  const resposta = await buscarPagina(baseUrl, params);
  return {
    itens: resposta.data,
    totalPaginas: resposta.totalPaginas,
    totalRegistros: resposta.totalRegistros,
  };
}

export async function buscarPncp(
  filtro: UniversalFilter,
  paginacao: Paginacao,
): Promise<ResultadoBusca> {
  const apenasAberto = filtro.apenasAberto ?? true;

  // Modalidades escolhidas pelo usuário têm prioridade. Sem escolha:
  // - "em aberto" (proposta) busca sem modalidade → 1 consulta por UF (rápido);
  // - "publicação" exige modalidade → usa as padrão (fan-out).
  const modalidadesSelecionadas =
    filtro.modalidades && filtro.modalidades.length > 0 ? filtro.modalidades : null;
  const modalidades: (number | undefined)[] = modalidadesSelecionadas
    ? modalidadesSelecionadas
    : apenasAberto
      ? [undefined]
      : DEFAULT_MODALIDADES;
  const ufs: (string | undefined)[] =
    filtro.ufs && filtro.ufs.length > 0 ? filtro.ufs : [undefined];

  const combinacoes = modalidades.flatMap((modalidadeId) =>
    ufs.map((uf) => ({ modalidadeId, uf })),
  );

  const paginas = await Promise.all(
    combinacoes.map((c) =>
      buscarCombo(filtro, apenasAberto, paginacao, c.modalidadeId, c.uf).catch(
        () => ({ itens: [] as PncpItem[], totalPaginas: 0, totalRegistros: 0 }),
      ),
    ),
  );

  const totalPaginas = paginas.reduce((m, p) => Math.max(m, p.totalPaginas), 0);
  const totalRegistros = paginas.reduce((s, p) => s + p.totalRegistros, 0);

  const vistos = new Set<string>();
  const itensBrutos: PncpItem[] = [];
  for (const p of paginas) {
    for (const item of p.itens) {
      if (vistos.has(item.numeroControlePNCP)) continue;
      vistos.add(item.numeroControlePNCP);
      itensBrutos.push(item);
    }
  }

  const keyword = filtro.keyword?.trim().toLowerCase();
  const orgaoFiltro = filtro.orgao?.trim().toLowerCase();

  const itens = itensBrutos
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

  return { itens, totalPaginas, totalRegistros };
}

export function nomeModalidade(id: number): string {
  return MODALIDADES.find((m) => m.id === id)?.nome ?? String(id);
}
