export type PlatformId = "pncp" | "comprasnet" | "ecompras-am" | "compras-manaus";

export interface PlatformInfo {
  id: PlatformId;
  nome: string;
  descricao: string;
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

export interface LicitacaoProvider {
  id: PlatformId;
  buscar(filtro: UniversalFilter): Promise<UnifiedLicitacao[]>;
}
