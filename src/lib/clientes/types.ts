export type Cliente = {
  id: string;
  user_id: string;
  nome: string;
  orgao: string;
  observacoes: string;
  status: string;
  proximo_passo: string;
  created_at: string;
};

export type ClienteDocumento = {
  id: string;
  cliente_id: string;
  user_id: string;
  tipo: string;
  nome: string;
  arquivo_path: string;
  arquivo_nome: string;
  created_at: string;
};

export type CategoriaCliente = { slug: string; nome: string; descricao: string };

export const CATEGORIAS_CLIENTE: CategoriaCliente[] = [
  { slug: "proposta", nome: "Propostas enviadas", descricao: "Propostas apresentadas a este cliente" },
  { slug: "nota_empenho", nome: "Notas de Empenho", descricao: "Empenhos emitidos pelo órgão" },
  { slug: "nota_fiscal", nome: "Notas Fiscais", descricao: "Notas fiscais emitidas" },
  { slug: "contrato", nome: "Contratos", descricao: "Contratos e aditivos firmados" },
];

export const CATEGORIA_AVULSO = "avulso";

export function nomeCategoria(slug: string): string {
  return CATEGORIAS_CLIENTE.find((c) => c.slug === slug)?.nome ?? "Outros";
}
