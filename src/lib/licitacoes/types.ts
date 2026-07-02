export type PlatformId = "pncp" | "comprasnet" | "ecompras-am" | "compras-manaus";

export interface PlatformInfo {
  id: PlatformId;
  nome: string;
  descricao: string;
}

/** Etapa do funil/pipeline de acompanhamento de uma licitação salva. */
export type EtapaSlug = "oportunidade" | "proposta_pronta" | "proposta_enviada" | "vencida" | "perdida";

export type EtapaInfo = {
  slug: EtapaSlug;
  nome: string;
  descricao: string;
};

export const ETAPAS_LICITACAO: EtapaInfo[] = [
  { slug: "oportunidade", nome: "Oportunidade", descricao: "Licitações salvas em análise" },
  { slug: "proposta_pronta", nome: "Proposta Pronta", descricao: "Proposta montada (assinada/anexada ou não)" },
  { slug: "proposta_enviada", nome: "Proposta Enviada", descricao: "Proposta enviada ao órgão, aguardando resultado" },
  { slug: "vencida", nome: "Licitação Vencida", descricao: "Ganha — vira cliente" },
  { slug: "perdida", nome: "Licitação Perdida", descricao: "Não seguirá adiante" },
];

export const ETAPA_PADRAO: EtapaSlug = "oportunidade";

const ETAPAS_VALIDAS = new Set<string>(ETAPAS_LICITACAO.map((etapa) => etapa.slug));

export const ETAPAS_LEGADAS: Record<string, EtapaSlug> = {
  aberta: "oportunidade",
  participando: "proposta_enviada",
  recusada: "perdida",
  concluida: "vencida",
};

export function normalizarEtapa(slug: string | null | undefined): EtapaSlug {
  if (!slug) return ETAPA_PADRAO;
  if (ETAPAS_VALIDAS.has(slug)) return slug as EtapaSlug;
  return ETAPAS_LEGADAS[slug] ?? ETAPA_PADRAO;
}

export function nomeEtapa(slug: string): string {
  const etapa = normalizarEtapa(slug);
  return ETAPAS_LICITACAO.find((e) => e.slug === etapa)?.nome ?? "Oportunidade";
}

export const PLATAFORMAS: PlatformInfo[] = [
  {
    id: "pncp",
    nome: "PNCP (Nacional)",
    descricao: "Portal Nacional de Contratações Públicas — todas as esferas e UFs",
  },
  {
    id: "comprasnet",
    nome: "Compras.gov.br (Federal)",
    descricao: "Licitações de órgãos da esfera federal, publicadas via PNCP",
  },
  {
    id: "ecompras-am",
    nome: "e-Compras AM",
    descricao: "Licitações de órgãos do Estado do Amazonas, publicadas via PNCP",
  },
  {
    id: "compras-manaus",
    nome: "Compras Manaus",
    descricao: "Licitações de órgãos do município de Manaus, publicadas via PNCP",
  },
];

export const MODALIDADES = [
  { id: 1, nome: "Leilão - Eletrônico" },
  { id: 2, nome: "Diálogo Competitivo" },
  { id: 3, nome: "Concurso" },
  { id: 4, nome: "Concorrência - Eletrônica" },
  { id: 5, nome: "Concorrência - Presencial" },
  { id: 6, nome: "Pregão - Eletrônico" },
  { id: 7, nome: "Pregão - Presencial" },
  { id: 8, nome: "Dispensa" },
  { id: 9, nome: "Inexigibilidade" },
  { id: 10, nome: "Manifestação de Interesse" },
  { id: 11, nome: "Pré-qualificação" },
  { id: 12, nome: "Credenciamento" },
  { id: 13, nome: "Leilão - Presencial" },
] as const;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export interface UniversalFilter {
  keyword?: string;
  ufs?: string[];
  modalidades?: number[];
  dataInicial: string;
  dataFinal: string;
  valorMin?: number;
  valorMax?: number;
  orgao?: string;
  plataformas: PlatformId[];
  /** Quando true (padrão), retorna apenas licitações com proposta em aberto. */
  apenasAberto?: boolean;
}

export interface UnifiedLicitacao {
  id: string;
  plataforma: PlatformId;
  numeroControlePNCP: string;
  titulo: string;
  descricao: string;
  orgao: string;
  esfera: string;
  uf: string;
  municipio: string;
  modalidade: string;
  situacao: string;
  valorEstimado: number | null;
  dataPublicacao: string | null;
  dataAberturaProposta: string | null;
  dataEncerramentoProposta: string | null;
  linkOrigem: string | null;
}

export interface Paginacao {
  /** Página solicitada (começa em 1). */
  pagina: number;
  tamanhoPagina: number;
}

export interface ResultadoBusca {
  itens: UnifiedLicitacao[];
  /** Maior número de páginas entre as consultas combinadas. */
  totalPaginas: number;
  /** Total aproximado de registros (soma das consultas). */
  totalRegistros: number;
  /** true quando alguma consulta ao PNCP falhou/expirou (resultado parcial). */
  incompleto?: boolean;
}

export interface LicitacaoItem {
  numeroItem: number;
  descricao: string;
  quantidade: number | null;
  unidadeMedida: string;
  valorUnitarioEstimado: number | null;
  valorTotal: number | null;
  tipoBeneficioNome: string; // ex.: "Participação exclusiva para ME/EPP", "Não se aplica"
}

/** true quando o item é de participação exclusiva para ME/EPP (tipoBeneficio do PNCP). */
export function ehExclusivoMeEpp(item: LicitacaoItem): boolean {
  return item.tipoBeneficioNome.toLowerCase().includes("exclusiv");
}

export interface LicitacaoProvider {
  id: PlatformId;
  buscar(filtro: UniversalFilter, paginacao: Paginacao): Promise<ResultadoBusca>;
}
