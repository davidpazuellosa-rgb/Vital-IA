export type Cliente = {
  id: string;
  user_id: string;
  nome: string;
  orgao: string;
  observacoes: string;
  status: string;
  proximo_passo: string;
  cnpj: string;
  inscricao_estadual: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  created_at: string;
};

export type Contratacao = {
  id: string;
  cliente_id: string;
  user_id: string;
  titulo: string;
  identificador: string;
  status: string;
  proximo_passo: string;
  created_at: string;
};

export type ClienteDocumento = {
  id: string;
  cliente_id: string;
  contratacao_id: string | null;
  user_id: string;
  tipo: string;
  nome: string;
  arquivo_path: string;
  arquivo_nome: string;
  created_at: string;
};

export type CategoriaCliente = { slug: string; nome: string; descricao: string };

/** Categorias de documentos dentro de uma contratação/licitação. */
export const CATEGORIAS_CONTRATACAO: CategoriaCliente[] = [
  { slug: "proposta", nome: "Proposta enviada", descricao: "Proposta apresentada nesta licitação" },
  { slug: "edital", nome: "Edital e Termo de Referência", descricao: "Edital, termo de referência e aviso de contratação" },
  { slug: "empenho", nome: "Nota de Empenho", descricao: "Empenhos emitidos pelo órgão" },
  { slug: "contrato", nome: "Contrato e Termos", descricao: "Contrato, termo de ciência e aditivos" },
  { slug: "nota_fiscal", nome: "Notas Fiscais", descricao: "Notas fiscais emitidas" },
  { slug: "declaracao_entrega", nome: "Declaração de Entrega", descricao: "Declarações para entrega dos itens vendidos" },
];

export const CATEGORIA_AVULSO = "avulso";

export function nomeCategoria(slug: string): string {
  return CATEGORIAS_CONTRATACAO.find((c) => c.slug === slug)?.nome ?? "Outros";
}
