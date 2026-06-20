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

export const CHECKLIST_DOCUMENTOS: TipoDocumento[] = [
  { slug: "cnd_federal", nome: "CND Federal", descricao: "Débitos Federais e Dívida Ativa da União (Receita/PGFN)" },
  { slug: "fgts", nome: "CRF / FGTS", descricao: "Certificado de Regularidade do FGTS" },
  { slug: "trabalhista", nome: "CNDT", descricao: "Certidão Negativa de Débitos Trabalhistas" },
  { slug: "estadual", nome: "Certidão Estadual", descricao: "Regularidade fiscal estadual" },
  { slug: "municipal", nome: "Certidão Municipal", descricao: "Regularidade fiscal municipal" },
  { slug: "falencia", nome: "Falência e Concordata", descricao: "Certidão negativa de falência/recuperação judicial" },
  { slug: "contrato_social", nome: "Contrato Social", descricao: "Contrato social ou estatuto e alterações" },
  { slug: "cnpj", nome: "Cartão CNPJ", descricao: "Comprovante de inscrição e situação cadastral" },
];

export const TIPO_AVULSO = "avulso";

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
