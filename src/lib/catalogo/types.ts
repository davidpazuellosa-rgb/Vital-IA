export type ItemCatalogo = {
  id: string;
  user_id: string;
  tipo: "produto" | "servico";
  nome: string;
  descricao: string;
  categoria: string;
  unidade: string;
  marca: string;
  codigo: string;
  custo: number | null;
  preco_referencia: number | null;
  margem_minima: number | null;
  fornecedores: string;
  observacoes: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

/** Campos editáveis (o que um formulário ou a Vita pode preencher). */
export type DadosItemCatalogo = Pick<
  ItemCatalogo,
  "tipo" | "nome" | "descricao" | "categoria" | "unidade" | "marca" | "codigo" | "custo" | "preco_referencia" | "margem_minima" | "fornecedores" | "observacoes" | "ativo"
>;

/** Margem real (%) do preço de referência sobre o custo, ou null. */
export function margemReal(custo: number | null, preco: number | null): number | null {
  if (custo == null || preco == null || custo <= 0) return null;
  return ((preco - custo) / custo) * 100;
}

/** Normaliza o que vier de formulário ou da Vita para os campos do banco. */
export function normalizarItem(bruto: Record<string, unknown>): DadosItemCatalogo {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
  const numero = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  const nome = texto(bruto.nome);
  if (!nome) throw new Error("Informe o nome do item.");
  return {
    tipo: texto(bruto.tipo) === "servico" ? "servico" : "produto",
    nome,
    descricao: texto(bruto.descricao),
    categoria: texto(bruto.categoria),
    unidade: texto(bruto.unidade).toUpperCase(),
    marca: texto(bruto.marca),
    codigo: texto(bruto.codigo),
    custo: numero(bruto.custo),
    preco_referencia: numero(bruto.preco_referencia),
    margem_minima: numero(bruto.margem_minima),
    fornecedores: texto(bruto.fornecedores),
    observacoes: texto(bruto.observacoes),
    ativo: bruto.ativo !== false && bruto.ativo !== "false",
  };
}
