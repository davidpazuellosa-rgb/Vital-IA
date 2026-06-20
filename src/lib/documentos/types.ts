export type Documento = {
  id: string;
  user_id: string;
  tipo: string;
  nome: string;
  arquivo_path: string;
  arquivo_nome: string;
  data_emissao: string | null;
  data_validade: string | null;
  validade_automatica: boolean;
  created_at: string;
};

/** Tipos de documento mais comuns na habilitação de licitações. */
export type TipoDocumento = {
  slug: string;
  nome: string;
  descricao: string;
};

/** Grupo (categoria) de documentos de habilitação, exibido recolhível. */
export type GrupoDocumentos = {
  slug: string;
  titulo: string;
  descricao: string;
  tipos: TipoDocumento[];
};

export const GRUPOS_DOCUMENTOS: GrupoDocumentos[] = [
  {
    slug: "fiscal_trabalhista",
    titulo: "Regularidade Fiscal e Trabalhista",
    descricao: "Certidões de débitos federais, estaduais, municipais, FGTS e trabalhista",
    tipos: [
      { slug: "cnd_federal", nome: "CND Federal", descricao: "Débitos Federais e Dívida Ativa da União (Receita/PGFN)" },
      { slug: "fgts", nome: "CRF / FGTS", descricao: "Certificado de Regularidade do FGTS" },
      { slug: "trabalhista", nome: "CNDT", descricao: "Certidão Negativa de Débitos Trabalhistas" },
      { slug: "estadual", nome: "Certidão Estadual", descricao: "Regularidade fiscal estadual" },
      { slug: "municipal", nome: "Certidão Municipal", descricao: "Regularidade fiscal municipal" },
    ],
  },
  {
    slug: "juridica",
    titulo: "Habilitação Jurídica",
    descricao: "Atos constitutivos da empresa",
    tipos: [
      { slug: "contrato_social", nome: "Contrato Social", descricao: "Contrato social ou estatuto e alterações" },
      { slug: "cnpj", nome: "Cartão CNPJ", descricao: "Comprovante de inscrição e situação cadastral" },
    ],
  },
  {
    slug: "economico_financeira",
    titulo: "Qualificação Econômico-Financeira",
    descricao: "Comprovação da saúde financeira da empresa",
    tipos: [
      { slug: "falencia", nome: "Falência e Concordata", descricao: "Certidão negativa de falência/recuperação judicial" },
      { slug: "balanco", nome: "Balanço Patrimonial", descricao: "Balanço e demonstrações contábeis do último exercício" },
    ],
  },
  {
    slug: "socios",
    titulo: "Documentos dos Sócios / Proprietários",
    descricao: "Documentação pessoal dos sócios e representantes",
    tipos: [
      { slug: "socio_identidade", nome: "Identidade e CPF", descricao: "RG e CPF dos sócios/proprietários" },
      { slug: "socio_residencia", nome: "Comprovante de Residência", descricao: "Comprovante de endereço dos sócios" },
    ],
  },
];

/** Lista achatada de todos os tipos do checklist (para selects e contagens). */
export const CHECKLIST_DOCUMENTOS: TipoDocumento[] = GRUPOS_DOCUMENTOS.flatMap((g) => g.tipos);

export const TIPO_AVULSO = "avulso";

/** Tipos que não expiram (atos constitutivos, documentos pessoais) — não validam por data. */
export const TIPOS_SEM_VALIDADE = new Set([
  "contrato_social",
  "cnpj",
  "balanco",
  "socio_identidade",
  "socio_residencia",
]);

export function tipoSemValidade(slug: string): boolean {
  return TIPOS_SEM_VALIDADE.has(slug);
}

const CHECKLIST_NOMES: Record<string, string> = Object.fromEntries(
  CHECKLIST_DOCUMENTOS.map((t) => [t.slug, t.nome]),
);

export function nomeTipo(slug: string): string {
  return CHECKLIST_NOMES[slug] ?? "Avulso";
}

export type StatusValidade = "valido" | "vence_em_breve" | "vencido" | "sem_data";

/** Dias de antecedência para alertar que um documento vai vencer. */
export const DIAS_ALERTA_VENCIMENTO = 15;

export type ResultadoValidade = {
  status: StatusValidade;
  rotulo: string;
  diasRestantes: number | null;
};

export function avaliarValidade(dataValidade: string | null): ResultadoValidade {
  if (!dataValidade) {
    return { status: "sem_data", rotulo: "Sem data", diasRestantes: null };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(`${dataValidade}T00:00:00`);
  const diasRestantes = Math.round((validade.getTime() - hoje.getTime()) / 86_400_000);

  if (diasRestantes < 0) {
    return { status: "vencido", rotulo: "Vencido", diasRestantes };
  }
  if (diasRestantes <= DIAS_ALERTA_VENCIMENTO) {
    return {
      status: "vence_em_breve",
      rotulo: diasRestantes === 0 ? "Vence hoje" : `Vence em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`,
      diasRestantes,
    };
  }
  return { status: "valido", rotulo: "Válido", diasRestantes };
}
