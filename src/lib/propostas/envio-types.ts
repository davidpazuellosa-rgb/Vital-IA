import type { PlataformaDetectada } from "@/lib/licitacoes/plataforma-origem";

export type ItemEnvio = {
  numeroItem: number;
  descricao: string;
  marca: string;
  quantidade: number | null;
  unidadeMedida: string;
  valorUnitario: number;
  selecionado: boolean;
};

export type EnvioRegistrado = {
  enviadaEm: string;
  protocolo: string;
  valor: number | null;
  observacoes: string;
  comprovanteNome: string | null;
  comprovanteUrl: string | null;
};

export type PacoteEnvio = {
  licitacao: {
    id: string;
    numeroControlePNCP: string;
    titulo: string;
    orgao: string;
    uf: string;
    municipio: string;
    modalidade: string;
    linkOrigem: string | null;
    abertura: string | null;
    encerramento: string | null;
    etapa: string;
  };
  plataforma: PlataformaDetectada | null;
  /** Atalho cadastrado em "Sistemas de Licitação" que corresponde à plataforma. */
  sistema: { id: string; nome: string; url: string; login: string } | null;
  proposta: {
    status: string;
    itens: ItemEnvio[];
    valorTotal: number;
    itensSemPreco: number;
    analisada: boolean;
    documentosDisponiveis: number;
    documentosPendentes: number;
    declaracoes: number;
  } | null;
  envio: EnvioRegistrado | null;
  empresaUserId: string;
};

export type DadosEnvio = {
  enviadaEm: string; // ISO
  protocolo: string;
  valor: number | null;
  observacoes: string;
  comprovante: { path: string; nome: string } | null;
};
