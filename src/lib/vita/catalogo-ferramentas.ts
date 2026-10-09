/* Catálogo das ferramentas da Vita, em linguagem de gente — usado na página "Vita" (ligar/desligar).
 * Seguro para o navegador (sem dependências do servidor). Ao criar uma ferramenta nova em
 * ferramentas.ts, acrescente-a aqui para ela aparecer na página. */

export type TipoFerramenta = "consulta" | "externa" | "aprovacao" | "memoria";

export const TIPOS_FERRAMENTA: Record<TipoFerramenta, { titulo: string; resumo: string }> = {
  consulta: { titulo: "Consultas ao sistema", resumo: "Só leem dados do Vital.IA" },
  externa: { titulo: "Fontes externas", resumo: "Consultam sites públicos (PNCP, Receita)" },
  aprovacao: { titulo: "Alterações", resumo: "Só acontecem depois que você aprova" },
  memoria: { titulo: "Memória", resumo: "Guardam e esquecem o que você conta" },
};

export type InfoFerramenta = { nome: string; titulo: string; descricao: string; tipo: TipoFerramenta };

export const INFO_FERRAMENTAS: InfoFerramenta[] = [
  { nome: "buscar_licitacoes", titulo: "Buscar licitações", tipo: "externa", descricao: "Pesquisa ao vivo no PNCP por palavra-chave, órgão, estado, modalidade e plataforma." },
  { nome: "detalhar_licitacao", titulo: "Ver itens de uma licitação", tipo: "externa", descricao: "Lê os dados e os itens (quantidade, valor, cota ME/EPP) de uma licitação no PNCP." },
  { nome: "consultar_cnaes", titulo: "Consultar CNAEs", tipo: "externa", descricao: "Busca na Receita o CNAE principal e os secundários da empresa." },
  { nome: "listar_licitacoes_salvas", titulo: "Consultar Minhas Licitações", tipo: "consulta", descricao: "Lista as licitações salvas, com etapa, prazo e situação da proposta." },
  { nome: "consultar_empresa", titulo: "Ver dados da empresa", tipo: "consulta", descricao: "Razão social, CNPJ, porte, CNAE, endereço e contato." },
  { nome: "consultar_documentos", titulo: "Conferir validade dos documentos", tipo: "consulta", descricao: "Mostra certidões e documentos do acervo que estão vencidos ou vencendo." },
  { nome: "consultar_dados", titulo: "Consultar o banco de dados", tipo: "consulta", descricao: "Lê clientes, contratações, propostas, notas fiscais, alertas, catálogo e configurações." },
  { nome: "ler_documento", titulo: "Ler documentos", tipo: "consulta", descricao: "Lê o conteúdo de arquivos do acervo e dos clientes (com OCR em PDF escaneado)." },
  { nome: "manual_do_sistema", titulo: "Manual do sistema", tipo: "consulta", descricao: "Explica como cada tela do Vital.IA funciona." },
  { nome: "salvar_licitacao", titulo: "Salvar licitação", tipo: "aprovacao", descricao: "Propõe salvar uma licitação em Minhas Licitações." },
  { nome: "remover_licitacao_salva", titulo: "Remover licitação salva", tipo: "aprovacao", descricao: "Propõe remover uma licitação (e o rascunho de proposta dela)." },
  { nome: "alterar_dados", titulo: "Alterar dados", tipo: "aprovacao", descricao: "Propõe cadastrar, alterar ou remover em catálogo, clientes, contratações, alertas, empresa e outros." },
  { nome: "rascunho_nota_fiscal", titulo: "Rascunho de nota fiscal", tipo: "aprovacao", descricao: "Propõe criar ou editar rascunhos de NF-e (a emissão continua só com você)." },
  { nome: "preencher_proposta", titulo: "Preencher proposta", tipo: "aprovacao", descricao: "Propõe preencher marca, preço e itens do rascunho de uma proposta." },
  { nome: "memorizar", titulo: "Memorizar", tipo: "memoria", descricao: "Guarda um fato ou preferência da empresa para as próximas conversas." },
  { nome: "esquecer_memoria", titulo: "Esquecer memória", tipo: "memoria", descricao: "Apaga uma memória quando você pede para esquecer." },
];

export const NOMES_FERRAMENTAS = INFO_FERRAMENTAS.map((f) => f.nome);
export const FERRAMENTAS_DE_MEMORIA = INFO_FERRAMENTAS.filter((f) => f.tipo === "memoria").map((f) => f.nome);

export const CATEGORIAS_MEMORIA = [
  { id: "geral", rotulo: "Geral" },
  { id: "empresa", rotulo: "Empresa" },
  { id: "preferencia", rotulo: "Preferência" },
  { id: "processo", rotulo: "Processo" },
  { id: "clientes", rotulo: "Clientes" },
  { id: "regra", rotulo: "Regra" },
] as const;
export type CategoriaMemoria = (typeof CATEGORIAS_MEMORIA)[number]["id"];
export const IDS_CATEGORIA = CATEGORIAS_MEMORIA.map((c) => c.id) as string[];
