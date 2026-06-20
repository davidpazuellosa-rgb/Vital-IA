export type PropostaConfiguracao = {
  validade_dias: number;
  impostos_inclusos: boolean;
  representante_legal: string;
  representante_cargo: string;
  observacoes_padrao: string;
};

export type { AnaliseEdital, RequisitoEdital, StatusRequisito } from "./analise-edital";

export const CONFIGURACAO_PROPOSTA_PADRAO: PropostaConfiguracao = {
  validade_dias: 60,
  impostos_inclusos: true,
  representante_legal: "",
  representante_cargo: "",
  observacoes_padrao: "Todos os tributos, encargos e despesas estão inclusos nos valores apresentados.",
};

export const REPRESENTANTES_LEGAIS = [
  {
    nome: "David Pazuello Franco de Sá",
    nomeCurto: "David",
    cargo: "Sócio Administrador",
  },
  {
    nome: "Ruy Menezes Leão Neto",
    nomeCurto: "Ruy",
    cargo: "Sócio Administrador",
  },
] as const;
