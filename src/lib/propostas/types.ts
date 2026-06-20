export type PropostaConfiguracao = {
  validade_dias: number;
  prazo_entrega: string;
  condicoes_pagamento: string;
  impostos_inclusos: boolean;
  representante_legal: string;
  representante_cargo: string;
  observacoes_padrao: string;
};

export type PropostaItem = {
  numero: number;
  descricao: string;
  quantidade: number | null;
  unidade: string;
  marca: string;
  valor_unitario: number | null;
};

export type PropostaRascunho = {
  status: "rascunho" | "pronta" | "enviada";
  validade_dias: number;
  prazo_entrega: string;
  condicoes_pagamento: string;
  observacoes: string;
  itens: PropostaItem[];
};

export const CONFIGURACAO_PROPOSTA_PADRAO: PropostaConfiguracao = {
  validade_dias: 60,
  prazo_entrega: "",
  condicoes_pagamento: "",
  impostos_inclusos: true,
  representante_legal: "",
  representante_cargo: "",
  observacoes_padrao: "Todos os tributos, encargos e despesas estão inclusos nos valores apresentados.",
};
