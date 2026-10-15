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
  /** "Outros" do grupo: aceita quantos documentos for preciso e não conta no checklist (nunca aparece como pendente). */
  extra: TipoDocumento;
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
    extra: { slug: "fiscal_outros", nome: "Outras certidões", descricao: "Outras certidões e comprovantes fiscais ou trabalhistas" },
  },
  {
    slug: "juridica",
    titulo: "Habilitação Jurídica",
    descricao: "Atos constitutivos da empresa",
    tipos: [
      { slug: "contrato_social", nome: "Contrato Social", descricao: "Contrato social ou estatuto e alterações" },
      { slug: "cnpj", nome: "Cartão CNPJ", descricao: "Comprovante de inscrição e situação cadastral" },
      { slug: "inscricao_estadual", nome: "Inscrição Estadual", descricao: "Comprovante de inscrição estadual" },
      { slug: "inscricao_municipal", nome: "Inscrição Municipal", descricao: "Comprovante de inscrição municipal" },
    ],
    extra: { slug: "juridica_outros", nome: "Outros — Habilitação Jurídica", descricao: "Outros documentos de habilitação jurídica" },
  },
  {
    slug: "economico_financeira",
    titulo: "Qualificação Econômico-Financeira",
    descricao: "Comprovação da saúde financeira da empresa",
    tipos: [
      { slug: "falencia", nome: "Falência e Concordata", descricao: "Certidão negativa de falência/recuperação judicial" },
      { slug: "balanco", nome: "Balanço Patrimonial", descricao: "Balanço e demonstrações contábeis do último exercício" },
      { slug: "conta_titularidade_1", nome: "Titularidade de Conta — Conta 1", descricao: "Comprovante de titularidade de conta bancária" },
      { slug: "conta_titularidade_2", nome: "Titularidade de Conta — Conta 2", descricao: "Comprovante de titularidade de conta bancária" },
    ],
    extra: { slug: "economico_outros", nome: "Outros — Econômico-Financeira", descricao: "Outros documentos econômico-financeiros" },
  },
  {
    slug: "tecnica",
    titulo: "Qualificação Técnica",
    descricao: "Comprovação de aptidão para execução do objeto",
    tipos: [
      { slug: "atestado_capacidade_tecnica", nome: "Atestado de Capacidade Técnica", descricao: "Atestado de capacidade técnica emitido por cliente" },
    ],
    extra: { slug: "tecnica_outros", nome: "Outros atestados e comprovações técnicas", descricao: "Outros atestados e comprovações de capacidade técnica" },
  },
  {
    slug: "socios",
    titulo: "Documentos dos Sócios / Proprietários",
    descricao: "Documentação pessoal dos sócios e representantes",
    tipos: [
      { slug: "socio_identidade_pazu", nome: "Identidade e CPF — Pazu", descricao: "RG e CPF do sócio Pazu" },
      { slug: "socio_identidade_ruy", nome: "Identidade e CPF — Ruy", descricao: "RG e CPF do sócio Ruy" },
      { slug: "socio_residencia", nome: "Comprovante de Residência", descricao: "Comprovante de endereço dos sócios" },
    ],
    extra: { slug: "socios_outros", nome: "Outros — Sócios", descricao: "Outros documentos de sócios e representantes" },
  },
  {
    slug: "declaracoes",
    titulo: "Declarações",
    descricao: "Declarações assinadas exigidas no edital",
    tipos: [
      { slug: "decl_enquadramento", nome: "Enquadramento ME/EPP", descricao: "Declaração de enquadramento como ME/EPP" },
      { slug: "decl_areas_atuacao", nome: "Áreas de Atuação", descricao: "Declaração de áreas de atuação" },
      { slug: "decl_nao_emprega_menor", nome: "Não emprega menor", descricao: "Declaração de que não emprega menor de idade (salvo aprendiz)" },
      { slug: "decl_nepotismo", nome: "Negativa de Nepotismo", descricao: "Declaração negativa de nepotismo" },
      { slug: "decl_equidade", nome: "Equidade entre homens e mulheres", descricao: "Declaração de equidade entre homens e mulheres (desempate, art. 60, III, Lei 14.133)" },
      { slug: "decl_integridade", nome: "Programa de Integridade", descricao: "Declaração de programa de integridade (desempate, art. 60, IV, Lei 14.133)" },
    ],
    extra: { slug: "decl_outras", nome: "Outras declarações", descricao: "Qualquer outra declaração (quantas forem precisas)" },
  },
  {
    slug: "modelo_proposta",
    titulo: "Modelo de Proposta",
    descricao: "Modelos de proposta usados em licitações vencidas, para reaproveitar",
    tipos: [
      { slug: "modelo_proposta", nome: "Modelo de Proposta", descricao: "Proposta vencedora usada como modelo" },
    ],
    extra: { slug: "modelo_proposta_outros", nome: "Outros modelos de proposta", descricao: "Outros modelos de proposta" },
  },
];

/** Lista achatada de todos os tipos do checklist (para selects e contagens). */
export const CHECKLIST_DOCUMENTOS: TipoDocumento[] = GRUPOS_DOCUMENTOS.flatMap((g) => g.tipos);

/** Checklist + os "Outros" de cada grupo: tudo o que um documento pode ser (selects, validação, nomes). */
export const TODOS_TIPOS: TipoDocumento[] = GRUPOS_DOCUMENTOS.flatMap((g) => [...g.tipos, g.extra]);

/** Todos os tipos que pertencem a um grupo (checklist + "outros"). */
export const tiposDoGrupo = (g: GrupoDocumentos): string[] => [...g.tipos.map((t) => t.slug), g.extra.slug];

export const TIPO_AVULSO = "avulso";

/** Tipos que não expiram (atos constitutivos, documentos pessoais) — não validam por data. */
export const TIPOS_SEM_VALIDADE = new Set([
  "contrato_social",
  "cnpj",
  "inscricao_estadual",
  "inscricao_municipal",
  "balanco",
  "atestado_capacidade_tecnica",
  "conta_titularidade_1",
  "conta_titularidade_2",
  "socio_identidade_pazu",
  "socio_identidade_ruy",
  "socio_residencia",
  "decl_enquadramento",
  "decl_areas_atuacao",
  "decl_nao_emprega_menor",
  "decl_nepotismo",
  "decl_equidade",
  "decl_integridade",
  "modelo_proposta",
  // "Outros" de cada grupo (menos as certidões fiscais, que têm validade)
  "juridica_outros",
  "economico_outros",
  "tecnica_outros",
  "socios_outros",
  "decl_outras",
  "modelo_proposta_outros",
]);

export function tipoSemValidade(slug: string): boolean {
  return TIPOS_SEM_VALIDADE.has(slug);
}

const CHECKLIST_NOMES: Record<string, string> = Object.fromEntries(
  TODOS_TIPOS.map((t) => [t.slug, t.nome]),
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

/**
 * Site oficial para emitir/renovar cada tipo de documento (2ª via). Só entram
 * os tipos que têm um portal público de emissão — documentos internos ou
 * pessoais (declarações, atestados, RG/CPF dos sócios, balanço, etc.) não
 * têm site aplicável e ficam de fora deste mapa.
 */
export const SITE_RESPONSAVEL: Record<string, string> = {
  cnd_federal: "https://servicos.receita.fazenda.gov.br/servicos/certidao/",
  fgts: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
  trabalhista: "https://cndt-certidao.tst.jus.br/",
  estadual: "https://www.sefaz.am.gov.br/portfolio-servicos/detalhes/541",
  municipal: "https://semefatende.manaus.am.gov.br/cidadao/certidoes/",
  cnpj: "https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp",
  inscricao_estadual: "https://sistemas.sefaz.am.gov.br/gcc/menucontribuinte/index.action",
  inscricao_municipal: "https://nfse-prd.manaus.am.gov.br/nfse/servlet/hloginconsultacadastral",
  falencia: "https://consultasaj.tjam.jus.br/esaj/portal.do?servico=810000",
};

export function siteResponsavel(slug: string): string | null {
  return SITE_RESPONSAVEL[slug] ?? null;
}

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
