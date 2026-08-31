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

// Tamanho de página nativa usado para localizar e montar a janela invertida
// (mais novo → mais antigo). Não precisa ser igual ao tamanhoPagina pedido
// pela UI; só afeta quantas chamadas nativas são necessárias por combo.
const TAM_JANELA = 50;

/**
 * A API do PNCP não tem parâmetro de ordenação: ela sempre devolve os itens
 * em ordem crescente de publicação (mais antigo primeiro). Para exibir do
 * mais novo para o mais antigo, calculamos aqui qual intervalo de índices
 * (0-based, na ordem crescente nativa) corresponde à página `pagina` quando
 * o combo é lido de trás para frente, em blocos de `tamanhoPagina`.
 * Ex.: página 1 = os últimos `tamanhoPagina` itens (os mais recentes).
 * Retorna `null` quando a página pedida está além do total de itens do combo.
 */
function janelaInvertida(
  totalRegistros: number,
  tamanhoPagina: number,
  pagina: number,
): { lo: number; hi: number } | null {
  const hi = totalRegistros - (pagina - 1) * tamanhoPagina - 1;
  if (hi < 0) return null;
  const lo = Math.max(0, totalRegistros - pagina * tamanhoPagina);
  return { lo, hi };
}

async function buscarCombo(
  filtro: UniversalFilter,
  apenasAberto: boolean,
  paginacao: Paginacao,
  modalidadeId: number | undefined,
  uf: string | undefined,
): Promise<PaginaCombo> {
  const baseUrl = apenasAberto ? PROPOSTA_URL : PUBLICACAO_URL;
  const baseParams = new URLSearchParams();
  if (modalidadeId != null) {
    baseParams.set("codigoModalidadeContratacao", String(modalidadeId));
  }
  if (apenasAberto) {
    baseParams.set("dataFinal", horizonteEncerramento());
  } else {
    baseParams.set("dataInicial", toYyyymmdd(filtro.dataInicial));
    baseParams.set("dataFinal", toYyyymmdd(filtro.dataFinal));
  }
  if (uf) baseParams.set("uf", uf);

  // 1ª chamada: os itens em si não são usados diretamente (são os mais
  // antigos do combo), mas é assim que descobrimos totalRegistros — a única
  // forma de calcular "onde fica o final" do combo, já que a API não ordena.
  const paramsUm = new URLSearchParams(baseParams);
  paramsUm.set("pagina", "1");
  paramsUm.set("tamanhoPagina", String(TAM_JANELA));
  const primeira = await buscarPagina(baseUrl, paramsUm);
  const totalRegistros = primeira.totalRegistros;
  const totalPaginas = Math.ceil(totalRegistros / paginacao.tamanhoPagina);

  if (totalRegistros === 0) {
    return { itens: [], totalPaginas: 0, totalRegistros: 0 };
  }

  const janela = janelaInvertida(totalRegistros, paginacao.tamanhoPagina, paginacao.pagina);
  if (!janela) {
    return { itens: [], totalPaginas, totalRegistros };
  }

  // A janela pedida cai em 1 ou 2 páginas nativas (tamanho TAM_JANELA) —
  // no máximo 2, porque o tamanho da janela nunca passa do tamanho da grade.
  const paginaNativaInicio = Math.floor(janela.lo / TAM_JANELA) + 1;
  const paginaNativaFim = Math.floor(janela.hi / TAM_JANELA) + 1;
  const numerosNativos =
    paginaNativaInicio === paginaNativaFim
      ? [paginaNativaInicio]
      : [paginaNativaInicio, paginaNativaFim];

  const paginasNativas = await Promise.all(
    numerosNativos.map(async (n) => {
      if (n === 1) return primeira.data;
      const p = new URLSearchParams(baseParams);
      p.set("pagina", String(n));
      p.set("tamanhoPagina", String(TAM_JANELA));
      const r = await buscarPagina(baseUrl, p);
      return r.data;
    }),
  );

  // Mapa índice-crescente → item, só com o que cai dentro da janela pedida.
  const porIndice = new Map<number, PncpItem>();
  numerosNativos.forEach((n, i) => {
    const base = (n - 1) * TAM_JANELA;
    paginasNativas[i].forEach((item, pos) => {
      const indice = base + pos;
      if (indice >= janela.lo && indice <= janela.hi) porIndice.set(indice, item);
    });
  });

  // Índice crescente = publicação crescente; invertendo, fica do mais novo
  // para o mais antigo (o que a UI deve exibir).
  const itens = [...porIndice.keys()]
    .sort((a, b) => b - a)
    .map((i) => porIndice.get(i)!);

  return { itens, totalPaginas, totalRegistros };
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
        () => ({ itens: [] as PncpItem[], totalPaginas: 0, totalRegistros: 0, falhou: true }),
      ),
    ),
  );

  const incompleto = paginas.some((p) => "falhou" in p && p.falhou);
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
    .map(mapItem)
    // Cada combo já vem do mais novo para o mais antigo, mas ao mesclar
    // várias combinações (múltiplas UFs/modalidades) a ordem entre elas não
    // é garantida — este sort final unifica o resultado mesclado.
    .sort((a, b) => (b.dataPublicacao ?? "").localeCompare(a.dataPublicacao ?? ""));

  return { itens, totalPaginas, totalRegistros, incompleto };
}

const TAMANHO_COLETA_FILTRO_LOCAL = 50;
const LIMITE_PAGINAS_COLETA = 25;

/**
 * Alguns adaptadores são recortes do PNCP (ex.: Compras.gov.br/Federal ou Manaus)
 * e precisam filtrar localmente campos que a API pública nem sempre expõe como
 * parâmetro. Se filtrarmos só a página atual, uma página de 20 pode virar 2 itens.
 * Aqui coletamos páginas PNCP suficientes antes de aplicar o recorte e só então
 * cortamos a página exibida.
 */
export async function buscarPncpComFiltroLocal(
  filtro: UniversalFilter,
  paginacao: Paginacao,
  predicado: (item: UnifiedLicitacao) => boolean,
): Promise<ResultadoBusca> {
  const alvo = paginacao.pagina * paginacao.tamanhoPagina;
  const vistos = new Set<string>();
  const coletados: UnifiedLicitacao[] = [];
  let paginaPncp = 1;
  let totalPaginasPncp = 1;
  let incompleto = false;

  do {
    const resultado = await buscarPncp(filtro, {
      pagina: paginaPncp,
      tamanhoPagina: TAMANHO_COLETA_FILTRO_LOCAL,
    });
    totalPaginasPncp = Math.max(totalPaginasPncp, resultado.totalPaginas);
    incompleto ||= Boolean(resultado.incompleto);

    for (const item of resultado.itens) {
      if (!predicado(item) || vistos.has(item.numeroControlePNCP)) continue;
      vistos.add(item.numeroControlePNCP);
      coletados.push(item);
    }

    paginaPncp += 1;
  } while (
    coletados.length < alvo + 1 &&
    paginaPncp <= totalPaginasPncp &&
    paginaPncp <= LIMITE_PAGINAS_COLETA
  );

  const inicio = (paginacao.pagina - 1) * paginacao.tamanhoPagina;
  const itens = coletados.slice(inicio, inicio + paginacao.tamanhoPagina);
  const chegouAoFim = paginaPncp > totalPaginasPncp;
  const totalRegistros = chegouAoFim ? coletados.length : Math.max(coletados.length, alvo + 1);

  return {
    itens,
    totalPaginas: Math.ceil(totalRegistros / paginacao.tamanhoPagina),
    totalRegistros,
    incompleto,
  };
}

export function nomeModalidade(id: number): string {
  return MODALIDADES.find((m) => m.id === id)?.nome ?? String(id);
}
