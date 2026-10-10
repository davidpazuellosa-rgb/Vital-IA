/* ---------------------------------------------------------------------------------------------
 * MAPA DO SISTEMA para a Vita: "o que procurar" → "onde está" (tabelas, documentos, páginas,
 * ferramentas). É a base do harness de busca: antes de responder sobre um assunto, a Vita consulta
 * o mapa (onde_encontrar) e segue as fontes, da mais confiável para a menos.
 * Dados puros: seguro para o servidor e o navegador. Ao criar uma tela/tabela/ferramenta nova,
 * acrescente o assunto aqui.
 * ------------------------------------------------------------------------------------------- */

export type FonteMapa =
  | { tipo: "documento"; tipos: string[]; nota?: string }
  | { tipo: "tabela"; tabela: string; colunas?: string; nota?: string }
  | { tipo: "ferramenta"; nome: string; nota?: string }
  | { tipo: "pagina"; rota: string; nota?: string }
  | { tipo: "externa"; nome: string; nota?: string };

export type EntradaMapa = {
  id: string;
  area: string;
  assunto: string;
  /** Palavras que o usuário usa para falar disso (sem acento, minúsculas). */
  palavras: string[];
  /** Da fonte mais confiável para a menos. */
  fontes: FonteMapa[];
  dica?: string;
};

export const AREAS_MAPA = [
  "Empresa", "Documentos de habilitação", "Licitações", "Propostas", "Clientes e contratos", "Notas fiscais", "Catálogo", "Alertas e portais", "Vita e sistema",
] as const;

export const MAPA: EntradaMapa[] = [
  /* ------------------------------------------- Empresa ------------------------------------------- */
  {
    id: "cnpj", area: "Empresa", assunto: "CNPJ da empresa", palavras: ["cnpj", "inscricao", "numero da empresa", "cadastro nacional"],
    fontes: [
      { tipo: "documento", tipos: ["cnpj"], nota: "Cartão CNPJ: fonte oficial (traz também razão social, porte, CNAEs e endereço)." },
      { tipo: "documento", tipos: ["contrato_social", "inscricao_estadual", "inscricao_municipal"], nota: "Costumam repetir o CNPJ." },
      { tipo: "tabela", tabela: "empresa", colunas: "cnpj", nota: "Cadastro digitado em Dados da Empresa (pode estar desatualizado)." },
    ],
    dica: "Use buscar_informacao(assunto=\"cnpj\"): lê os documentos e compara com o cadastro.",
  },
  {
    id: "razao_social", area: "Empresa", assunto: "Razão social e nome fantasia", palavras: ["razao social", "nome empresarial", "nome fantasia", "nome da empresa", "denominacao"],
    fontes: [{ tipo: "documento", tipos: ["cnpj", "contrato_social"] }, { tipo: "tabela", tabela: "empresa", colunas: "razao_social, nome_fantasia" }],
    dica: "buscar_informacao(assunto=\"razão social\").",
  },
  {
    id: "cartao_cnpj", area: "Empresa", assunto: "Dados cadastrais completos (porte, natureza jurídica, abertura, CNAEs, endereço, contato, situação)",
    palavras: ["dados cadastrais", "dados da empresa", "informacoes da empresa", "perfil da empresa", "porte", "natureza juridica", "data de abertura", "situacao cadastral", "cartao cnpj"],
    fontes: [
      { tipo: "documento", tipos: ["cnpj"], nota: "Cartão CNPJ." },
      { tipo: "tabela", tabela: "empresa", colunas: "porte, natureza_juridica, data_abertura, cnae_principal, endereço, email, telefone" },
      { tipo: "externa", nome: "Receita (BrasilAPI)", nota: "consultar_cnaes traz CNAE principal e secundários atualizados." },
    ],
    dica: "buscar_informacao(assunto=\"dados cadastrais\") devolve tudo do Cartão CNPJ de uma vez.",
  },
  {
    id: "cnae", area: "Empresa", assunto: "CNAEs (atividades econômicas)", palavras: ["cnae", "atividade economica", "atividades", "ramo", "objeto social", "compativel"],
    fontes: [
      { tipo: "documento", tipos: ["cnpj"], nota: "Principal e secundárias do Cartão CNPJ." },
      { tipo: "externa", nome: "Receita (BrasilAPI)", nota: "ferramenta consultar_cnaes." },
      { tipo: "tabela", tabela: "empresa", colunas: "cnae_principal" },
    ],
  },
  {
    id: "inscricoes", area: "Empresa", assunto: "Inscrição estadual e municipal", palavras: ["inscricao estadual", "inscricao municipal", "ie", "im", "icms"],
    fontes: [{ tipo: "documento", tipos: ["inscricao_estadual", "inscricao_municipal"] }, { tipo: "tabela", tabela: "empresa", colunas: "inscricao_estadual, inscricao_municipal" }],
  },
  {
    id: "endereco", area: "Empresa", assunto: "Endereço, telefone e e-mail da empresa", palavras: ["endereco", "sede", "cep", "telefone", "email", "e-mail", "contato", "onde fica"],
    fontes: [{ tipo: "documento", tipos: ["cnpj"] }, { tipo: "tabela", tabela: "empresa", colunas: "logradouro, numero, bairro, municipio, uf, cep, telefone, email" }],
  },
  {
    id: "socios", area: "Empresa", assunto: "Sócios, administradores e capital social", palavras: ["socio", "socios", "administrador", "capital social", "quotas", "representante legal", "proprietario", "dono"],
    fontes: [
      { tipo: "documento", tipos: ["contrato_social"], nota: "Quadro societário, administração e capital." },
      { tipo: "documento", tipos: ["socio_identidade_pazu", "socio_identidade_ruy", "socio_residencia"], nota: "Documentos pessoais (RG/CPF/residência)." },
      { tipo: "tabela", tabela: "proposta_configuracao", colunas: "representante_legal, representante_cargo", nota: "Quem assina as propostas." },
    ],
  },
  {
    id: "banco", area: "Empresa", assunto: "Dados bancários", palavras: ["banco", "agencia", "conta", "titularidade", "dados bancarios", "pix"],
    fontes: [{ tipo: "documento", tipos: ["conta_titularidade_1", "conta_titularidade_2"] }, { tipo: "tabela", tabela: "empresa", colunas: "dados_bancarios" }],
  },
  /* ------------------------------------- Documentos de habilitação ------------------------------------- */
  {
    id: "validade_documentos", area: "Documentos de habilitação", assunto: "Validade das certidões e documentos (vencidos / vencendo)", palavras: ["validade", "vencido", "vencendo", "vence", "certidao", "certidoes", "cnd", "fgts", "cndt", "regularidade"],
    fontes: [{ tipo: "ferramenta", nome: "consultar_documentos" }, { tipo: "tabela", tabela: "documentos", colunas: "tipo, nome, data_emissao, data_validade" }, { tipo: "pagina", rota: "/documentos" }],
  },
  {
    id: "conteudo_documentos", area: "Documentos de habilitação", assunto: "Qualquer informação que esteja DENTRO de um documento do acervo", palavras: ["no documento", "no arquivo", "nos documentos", "consta", "diz o", "balanco", "atestado", "declaracao", "contrato social"],
    fontes: [
      { tipo: "ferramenta", nome: "pesquisar_documentos", nota: "Busca por termos no conteúdo (lê e indexa os arquivos que precisar)." },
      { tipo: "ferramenta", nome: "ler_documento", nota: "Lê um arquivo inteiro." },
    ],
    dica: "Tipos: certidões (cnd_federal, fgts, trabalhista, estadual, municipal), jurídicos (contrato_social, cnpj, inscrições), financeiros (falencia, balanco, contas), técnico (atestado_capacidade_tecnica), sócios, declarações (decl_*), modelo_proposta.",
  },
  {
    id: "exigencias_edital", area: "Documentos de habilitação", assunto: "Documentos que o edital exige e se a empresa tem", palavras: ["exigencia", "exige", "habilitacao", "edital pede", "documentos do edital", "checklist"],
    fontes: [{ tipo: "pagina", rota: "/licitacao/[id]", nota: "Criar proposta → análise do edital cruzada com o acervo (Disponível/Faltante/Vencido)." }, { tipo: "tabela", tabela: "propostas", colunas: "analise_edital" }],
  },
  /* -------------------------------------------- Licitações -------------------------------------------- */
  {
    id: "buscar_licitacoes", area: "Licitações", assunto: "Encontrar licitações abertas", palavras: ["buscar", "procurar", "licitacao aberta", "oportunidade", "pregao", "pncp", "edital novo"],
    fontes: [{ tipo: "ferramenta", nome: "buscar_licitacoes", nota: "Ao vivo no PNCP (palavra-chave, órgão, UF, modalidade, plataforma)." }, { tipo: "pagina", rota: "/busca" }],
  },
  {
    id: "licitacoes_salvas", area: "Licitações", assunto: "Minhas licitações salvas (etapa, prazo, observações)", palavras: ["salvas", "minhas licitacoes", "etapa", "oportunidade", "proposta pronta", "vencida", "perdida", "prazo", "encerra"],
    fontes: [{ tipo: "ferramenta", nome: "listar_licitacoes_salvas" }, { tipo: "tabela", tabela: "saved_licitacoes", colunas: "titulo, orgao, uf, etapa, valor_estimado, data_encerramento_proposta, observacoes" }, { tipo: "pagina", rota: "/minhas-licitacoes" }],
  },
  {
    id: "itens_licitacao", area: "Licitações", assunto: "Itens, quantidades e valores de uma licitação", palavras: ["itens", "item", "quantidade", "valor unitario", "descricao do item", "me epp", "cota"],
    fontes: [{ tipo: "ferramenta", nome: "detalhar_licitacao", nota: "Itens ao vivo do PNCP." }, { tipo: "pagina", rota: "/licitacao/[id]" }],
  },
  {
    id: "edital_arquivos", area: "Licitações", assunto: "Arquivos do edital (PDF), local de entrega e exigências", palavras: ["edital", "termo de referencia", "anexo", "local de entrega", "entrega", "garantia", "prazo de entrega"],
    fontes: [{ tipo: "pagina", rota: "/licitacao/[id]", nota: "Baixar edital (ZIP); Criar proposta lê o edital inteiro." }, { tipo: "documento", tipos: [], nota: "Se virou cliente (Vencida), o edital fica em cliente_documentos (tipo edital): pesquisar_documentos(escopo=\"clientes\")." }],
  },
  /* -------------------------------------------- Propostas -------------------------------------------- */
  {
    id: "propostas", area: "Propostas", assunto: "Rascunho, valor global e envio das propostas", palavras: ["proposta", "rascunho", "valor global", "marca", "preco", "enviada", "protocolo", "comprovante"],
    fontes: [{ tipo: "tabela", tabela: "propostas", colunas: "status, itens, valor_enviado, enviada_em, protocolo_envio, plataforma_envio" }, { tipo: "ferramenta", nome: "preencher_proposta" }, { tipo: "pagina", rota: "/licitacao/[id]" }],
  },
  {
    id: "config_proposta", area: "Propostas", assunto: "Padrões da proposta (validade, impostos, representante legal)", palavras: ["validade da proposta", "impostos inclusos", "representante", "observacoes padrao"],
    fontes: [{ tipo: "tabela", tabela: "proposta_configuracao" }, { tipo: "pagina", rota: "/vital-norte/dados" }],
  },
  /* ---------------------------------------- Clientes e contratos ---------------------------------------- */
  {
    id: "clientes", area: "Clientes e contratos", assunto: "Clientes (órgãos), contratações e próximos passos", palavras: ["cliente", "orgao", "contratacao", "contrato", "empenho", "proximo passo", "status"],
    fontes: [{ tipo: "tabela", tabela: "clientes", colunas: "nome, orgao, status, proximo_passo, cnpj, endereço" }, { tipo: "tabela", tabela: "contratacoes", colunas: "cliente_id, titulo, identificador, status" }, { tipo: "pagina", rota: "/vital-norte/clientes" }],
  },
  {
    id: "docs_clientes", area: "Clientes e contratos", assunto: "Documentos de clientes (proposta final, edital, empenho, contrato, NFs)", palavras: ["empenho", "contrato assinado", "proposta final", "nota de empenho", "documentos do cliente"],
    fontes: [{ tipo: "tabela", tabela: "cliente_documentos", colunas: "tipo, nome, cliente_id, contratacao_id" }, { tipo: "ferramenta", nome: "pesquisar_documentos", nota: "escopo=\"clientes\"." }, { tipo: "ferramenta", nome: "ler_documento", nota: "origem=cliente_documentos." }],
  },
  /* -------------------------------------------- Notas fiscais -------------------------------------------- */
  {
    id: "notas", area: "Notas fiscais", assunto: "Notas fiscais (rascunhos, autorizadas, valores, destinatário)", palavras: ["nota fiscal", "nf-e", "nfe", "danfe", "xml", "emitida", "autorizada", "rascunho de nota"],
    fontes: [{ tipo: "tabela", tabela: "notas_fiscais", colunas: "status, numero, valor_total, itens, destinatario_*" }, { tipo: "ferramenta", nome: "rascunho_nota_fiscal", nota: "Só rascunhos; emitir é só na tela." }, { tipo: "pagina", rota: "/vital-norte/nota-fiscal" }],
  },
  /* ---------------------------------------------- Catálogo ---------------------------------------------- */
  {
    id: "catalogo", area: "Catálogo", assunto: "Produtos e serviços da empresa: custo, preço de referência, margem", palavras: ["catalogo", "produto", "servico", "custo", "preco de referencia", "margem", "fornecedor", "marca"],
    fontes: [{ tipo: "tabela", tabela: "catalogo_itens", colunas: "nome, categoria, unidade, marca, custo, preco_referencia, margem_minima, fornecedores" }, { tipo: "pagina", rota: "/vital-norte/catalogo" }],
    dica: "A margem é (preço − custo) / custo; consultar_dados já devolve margem_real_sobre_custo.",
  },
  /* ------------------------------------------ Alertas e portais ------------------------------------------ */
  {
    id: "alertas", area: "Alertas e portais", assunto: "Alertas automáticos de licitação e canais de aviso", palavras: ["alerta", "aviso", "telegram", "email de aviso", "notificacao", "palavra-chave do alerta"],
    fontes: [{ tipo: "tabela", tabela: "alertas" }, { tipo: "tabela", tabela: "notificacoes_config", colunas: "telegram_chat_id, email_destino", nota: "Tokens e chaves NÃO são visíveis." }, { tipo: "pagina", rota: "/vital-norte/alertas" }],
  },
  {
    id: "portais", area: "Alertas e portais", assunto: "Portais de licitação em que a empresa tem cadastro (link e login)", palavras: ["portal", "sistema de licitacao", "bll", "licitar digital", "licitanet", "compras.gov", "login do portal", "link do portal"],
    fontes: [{ tipo: "tabela", tabela: "sistemas_licitacao", colunas: "nome, url, login, observacoes", nota: "Senhas NÃO são guardadas." }, { tipo: "pagina", rota: "/vital-norte/sistemas" }],
  },
  /* ------------------------------------------- Vita e sistema ------------------------------------------- */
  {
    id: "vita", area: "Vita e sistema", assunto: "Memórias, ferramentas e avaliações da Vita", palavras: ["memoria", "memorias", "lembrar", "ferramentas da vita", "avaliacao", "gostei"],
    fontes: [{ tipo: "pagina", rota: "/vita" }, { tipo: "tabela", tabela: "vita_memorias" }],
  },
  {
    id: "como_funciona", area: "Vita e sistema", assunto: "Como cada tela do sistema funciona", palavras: ["como funciona", "como faco", "onde fica", "tela", "botao", "passo a passo"],
    fontes: [{ tipo: "ferramenta", nome: "manual_do_sistema", nota: "Tópicos: busca, minhas_licitacoes, criar_proposta, enviar_proposta, documentos, dados_empresa, sistemas, catalogo, clientes, nota_fiscal, alertas, vita, fluxo_completo." }],
  },
];

/** Páginas do sistema e o que há em cada uma (para a Vita saber para onde levar o usuário). */
export const PAGINAS_MAPA: Array<{ rota: string; nome: string; tem: string }> = [
  { rota: "/busca", nome: "Busca", tem: "Pesquisa de licitações ao vivo no PNCP e plataformas; salvar." },
  { rota: "/minhas-licitacoes", nome: "Minhas Licitações", tem: "Licitações salvas por etapa, painel de propostas em andamento, criar proposta e registrar envio." },
  { rota: "/licitacao/[id]", nome: "Perfil da licitação", tem: "Dados, itens, ações (CSV, proposta, edital ZIP), etapa." },
  { rota: "/assinador-propostas", nome: "Assinador de Propostas", tem: "Guia para assinar no gov.br." },
  { rota: "/vita", nome: "Vita", tem: "Memórias, ferramentas (ligar/desligar), avaliações e este mapa." },
  { rota: "/documentos", nome: "Documentos", tem: "Acervo de habilitação (24 tipos) com validade." },
  { rota: "/vital-norte/sistemas", nome: "Sistemas de Licitação", tem: "Atalhos dos portais (URL e login)." },
  { rota: "/vital-norte/dados", nome: "Dados da Empresa", tem: "Cadastro da empresa e padrões da proposta." },
  { rota: "/vital-norte/catalogo", nome: "Catálogo", tem: "Produtos e serviços com custo, preço e margem." },
  { rota: "/vital-norte/clientes", nome: "Clientes", tem: "Clientes, contratações e documentos de cada uma." },
  { rota: "/vital-norte/nota-fiscal", nome: "Nota Fiscal", tem: "Rascunhos e NF-e emitidas (homologação)." },
  { rota: "/vital-norte/alertas", nome: "Alertas", tem: "Buscas automáticas e canais de aviso." },
  { rota: "/configuracoes", nome: "Configurações", tem: "Atalhos para as configurações." },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Entradas do mapa que mais combinam com a consulta (por palavras e pelo próprio assunto). */
export function procurarNoMapa(consulta: string, limite = 3): EntradaMapa[] {
  const q = semAcento(consulta);
  const termos = q.split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  if (!termos.length) return [];
  const pontuadas = MAPA.map((e) => {
    let pontos = 0;
    for (const p of e.palavras) {
      const palavra = semAcento(p);
      if (q.includes(palavra)) pontos += palavra.includes(" ") ? 4 : 3;
      else if (termos.some((t) => t.length > 3 && palavra.includes(t))) pontos += 1;
    }
    if (q.includes(semAcento(e.id.replace(/_/g, " ")))) pontos += 4;
    return { e, pontos };
  }).filter((x) => x.pontos > 0);
  return pontuadas.sort((a, b) => b.pontos - a.pontos).slice(0, limite).map((x) => x.e);
}

/** Índice compacto (assunto → onde) para as instruções da Vita. */
export function indiceDoMapa(): string {
  return MAPA.map((e) => {
    const onde = e.fontes.map((f) =>
      f.tipo === "documento" ? `docs[${f.tipos.join("/") || "clientes"}]` :
      f.tipo === "tabela" ? `tabela ${f.tabela}` :
      f.tipo === "ferramenta" ? `ferramenta ${f.nome}` :
      f.tipo === "pagina" ? `página ${f.rota}` : f.nome).join(" > ");
    return `- ${e.assunto}: ${onde}`;
  }).join("\n");
}
