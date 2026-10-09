/* ---------------------------------------------------------------------------------------------
 * Manual do Vital.IA para a Vita: como cada tela funciona, botões, regras e automações.
 * Fonte: o próprio código. Ao mudar uma tela, atualize o tópico correspondente.
 * ------------------------------------------------------------------------------------------- */

const MANUAL: Record<string, string> = {
  visao_geral: `Vital.IA — sistema de licitações públicas da empresa.
Menu lateral: Busca, Minhas Licitações, Assinador de Propostas; grupo "Vital Norte": Documentos, Sistemas de Licitação, Dados da Empresa, Catálogo, Clientes, Nota Fiscal, Alertas; rodapé: Configurações e Sair.
Botão "Vita" no topo à direita (atalho ⌘J / Ctrl+J) abre a assistente.
Compartilhado por toda a empresa: documentos (acervo), dados da empresa, configuração de proposta, sistemas de licitação, catálogo. Por usuário: licitações salvas, propostas, clientes, contratações, notas fiscais, alertas.
Arquivos ficam num armazenamento privado. Login por e-mail e senha.`,

  busca: `Busca (/busca): pesquisa AO VIVO no PNCP (nada é copiado para o banco até o usuário salvar).
Filtros: "Somente em aberto para proposta" (ligado por padrão); palavra-chave ou nº de controle PNCP; órgão (com sugestões); plataformas (várias); publicado de/até (padrão últimos 30 dias); valor mín/máx; UF (várias); modalidade (várias).
Plataformas: PNCP (nacional), Compras.gov.br (PNCP esfera federal), e-Compras AM (PNCP UF=AM), Compras Manaus (Manaus), e Licitar Digital, BLL Compras, Licitanet, Portal de Compras Públicas, BNC Compras (PNCP filtrado pelo link de origem; exigem palavra-chave ou UF com "em aberto").
Se a palavra-chave for um nº de controle PNCP, traz exatamente aquela licitação. 20 resultados por página. Cada cartão: Salvar, "Ver no PNCP", e clique abre o detalhe (/licitacao/pncp?n=…) com objeto e itens.`,

  minhas_licitacoes: `Minhas Licitações (/minhas-licitacoes): licitações salvas, em abas por etapa:
- oportunidade (Oportunidade — em análise; padrão ao salvar)
- proposta_pronta (Proposta Pronta — montada; mudança MANUAL)
- proposta_enviada (Proposta Enviada — aguardando resultado; automática ao "Marcar como enviada")
- vencida (Licitação Vencida — vira cliente)
- perdida (Licitação Perdida)
Painel "Propostas em andamento": proposta pronta ou com rascunho, não enviada e no prazo, ordenadas pelo prazo (urgente <24h, atenção ≤2 dias, ok, encerrado), com botão Enviar proposta.
Cada cartão: Criar proposta / Abrir rascunho, Enviar, seletor de etapa, remover. Selo "Salvo alerta" quando veio de um alerta.
Ao marcar VENCIDA: cria (ou reaproveita) o cliente com o nome do órgão, cria a contratação com o nº PNCP, e anexa automaticamente os arquivos do edital do PNCP em cliente_documentos (tipo edital); depois abre a contratação.`,

  detalhe_licitacao: `Detalhe da licitação salva (/licitacao/[id]): dados (objeto, órgão, modalidade, local, situação, datas, esfera, local de entrega tirado do edital), resumo financeiro, tabela de itens.
Coluna Ações: etapa; Extrair itens (CSV) — todos ou só exclusivos ME/EPP; Criar proposta / Abrir rascunho; Comparar preços (em breve); Baixar edital (ZIP com todos os arquivos do PNCP).`,

  criar_proposta: `Criar proposta (diálogo): na 1ª vez analisa o edital — baixa todos os arquivos do PNCP, lê todas as páginas (OCR por IA em PDF escaneado), extrai com regras + IA, e salva a análise.
Mostra: arquivos/páginas lidos, documentos exigidos cruzados com o acervo (Disponível, Faltante, Vencido, A gerar), declarações, condições (validade, entrega, pagamento, local, garantia).
Montagem: anexar planilha XLSX/CSV (preenche marca e valor unitário pelo nº do item) ou imagem; Baixar declarações (PDF "Caderno de declarações"); Importar assinado (declarações assinadas, vão ao fim do PDF); Importar proposta final (PDF assinado, guardado no cliente/contratação como "Proposta enviada").
Itens: marcar, marca, valor unitário; valor global. Salvar rascunho. Exportar proposta em PDF (exige preço e quantidade > 0 em todos os itens marcados): "Proposta comercial" com dados da empresa, itens, validade, banco, impostos, declarações, assinatura + documentos de habilitação disponíveis + declarações assinadas; status vira "gerada". Analisar novamente refaz a análise.`,

  enviar_proposta: `Enviar proposta (diálogo): O SISTEMA NÃO ENVIA NA PLATAFORMA — o usuário envia lá e registra aqui.
Mostra resumo (copiar nº PNCP, prazo), detecta a plataforma pelo link, botão "Abrir [sistema]" (reusa a aba e copia o login cadastrado em Sistemas de Licitação).
Checklist automático (itens com preço, documentos, prazo) e manual (conferi preços/marcas, proposta assinada no gov.br, declarações assinadas).
Downloads: Habilitação em ZIP (só documentos válidos no momento, com LEIAME.txt do que entrou/faltou) e declarações. Copiar valores/tabela dos itens.
"Marcar como enviada": data, protocolo, valor enviado, observações, comprovante → proposta "enviada" e etapa "Proposta Enviada". "Desfazer envio" volta para rascunho / Proposta Pronta.
Lembretes automáticos (Telegram/e-mail) 24h e 3h antes do prazo se a proposta não foi registrada como enviada.`,

  documentos: `Documentos (/documentos): acervo de habilitação compartilhado pela empresa.
Adicionar documento: tipo (do checklist ou avulso), nome, arquivo (PDF ou imagem). Cartões: checklist enviado X/24, vencidos, total.
Grupos: Regularidade Fiscal e Trabalhista (CND Federal, CRF/FGTS, CNDT, Certidão Estadual, Certidão Municipal); Habilitação Jurídica (Contrato Social, Cartão CNPJ, Inscrição Estadual, Inscrição Municipal); Qualificação Econômico-Financeira (Falência e Concordata, Balanço Patrimonial, Titularidade de Conta 1 e 2); Qualificação Técnica (Atestado de Capacidade Técnica); Sócios (Identidade/CPF Pazu, Identidade/CPF Ruy, Comprovante de Residência); Declarações (Enquadramento ME/EPP, Áreas de Atuação, Não emprega menor, Negativa de Nepotismo); Modelo de Proposta; e Outros (avulsos). Cada grupo tem "Baixar todos" (ZIP).
Só vencem: CND Federal, FGTS, CNDT, Estadual, Municipal e Falência. A validade é lida automaticamente do PDF (selo "auto"); "vence em breve" = 15 dias ou menos.
Menu do documento: Visualizar, Baixar, Site responsável (emitir nova via), Substituir arquivo, Renomear, Editar validade, Remover.`,

  assinador: `Assinador de Propostas (/assinador-propostas): guia para assinar no gov.br (o gov.br não permite embutir no sistema). Passos: baixar o PDF no Vital.IA → abrir o Assinador gov.br → assinar → voltar e usar "Importar assinado" / "Importar proposta final".`,

  dados_empresa: `Dados da Empresa (/vital-norte/dados): formulário manual (razão social, fantasia, CNPJ, porte ME/EPP/Demais, natureza jurídica, abertura, CNAE principal, inscrições, endereço, contato, dados bancários). A Vita NÃO altera esses dados — o usuário edita na tela. Os CNAEs secundários podem ser consultados na Receita pela Vita (consultar_cnaes).
Cartão "Propostas": checklist de prontidão (dados cadastrais/bancários, modelo de proposta no acervo, padrões, responsável) e padrões: validade (dias, padrão 60), representante legal (David Pazuello Franco de Sá ou Ruy Menezes Leão Neto, cargo Sócio Administrador), impostos inclusos, observações padrão.
Configurações (/configuracoes) só tem atalhos para estas telas.`,

  sistemas: `Sistemas de Licitação (/vital-norte/sistemas): atalhos para os portais onde a empresa tem cadastro (BLL Compras, Licitar Digital, Compras.gov.br, Licitanet, e-Compras AM, Compras Manaus, Petronect…). Cada um: nome, endereço, login (copiável), observações; "Abrir" reaproveita a aba para manter o login. SENHAS NÃO SÃO GUARDADAS. Os portais não podem ser embutidos no sistema.`,

  catalogo: `Catálogo (/vital-norte/catalogo): produtos e serviços que a empresa vende. Campos: tipo (produto/serviço), nome, descrição, categoria, unidade, marca, código, custo, preço de referência, margem mínima (%), fornecedores, observações, ativo. A tela mostra a margem real sobre o custo ((preço − custo) / custo) em vermelho quando fica abaixo da mínima.
A Vita pode cadastrar/alterar/remover itens (com aprovação), inclusive vários de uma vez a partir de uma planilha ou lista anexada, e comparar os itens de um edital com o catálogo para sugerir preço e marca.`,

  clientes: `Clientes (/vital-norte/clientes): órgãos que contrataram a empresa (normalmente criados ao marcar uma licitação como Vencida, ou manualmente: nome e órgão).
Página do cliente: status, próximo passo; "Dados do órgão (para nota fiscal)" — CNPJ + Buscar e salvar (Receita via BrasilAPI); notas fiscais; lista de contratações (Nova licitação: título e identificador).
Contratação: status, próximo passo, documentos por categoria — Proposta enviada, Edital e Termo de Referência, Nota de Empenho, Contrato e Termos, Notas Fiscais, outros. "Baixar tudo" em PDF único ou ZIP.`,

  nota_fiscal: `Nota Fiscal (/vital-norte/nota-fiscal): emissão de NF-e (hoje em HOMOLOGAÇÃO, sem valor fiscal). A VITA NÃO EMITE, NÃO CANCELA E NÃO ALTERA NOTAS — apenas consulta.
Nova nota (rascunho): cliente e contratação opcionais (preenchem o destinatário), natureza da operação, interna (AM, CFOP 5xxx) ou interestadual (6xxx), destinatário (CNPJ com busca automática, indicador de IE, endereço completo), itens (descrição, NCM, CFOP, unidade, qtd, valor), observações.
Ações: Editar e Emitir (só rascunho), Atualizar status (processando), DANFE, XML, Anexar à contratação, Remover (rascunho/rejeitada/cancelada); no detalhe: Carta de correção e Cancelar nota (autorizada). Status: rascunho, processando, autorizada, rejeitada, cancelada. Quando autorizada, DANFE e XML vão automaticamente para os documentos do cliente.`,

  alertas: `Alertas (/vital-norte/alertas): buscas automáticas de hora em hora no PNCP (últimos 30 dias, até 30 resultados). Cada alerta: nome, palavra-chave, UFs, valor mín/máx, somente em aberto, ativo/pausado (a coluna modalidades existe mas a tela não mostra).
O que um alerta encontra é SALVO automaticamente em Minhas Licitações (Oportunidade) e as novidades são avisadas por Telegram e/ou e-mail (até 8 por aviso).
Canais: Telegram (token do bot + chat id) e e-mail (Resend). WhatsApp ainda não conectado. A Vita não vê nem altera tokens/chaves.`,

  vita: `Vita: assistente de IA. Busca licitações no PNCP, detalha itens, consulta qualquer dado do sistema, lê documentos do acervo e dos clientes, lê até 8 anexos por mensagem (PDF, imagens, XLSX, CSV, DOCX, TXT; 20 MB cada), consulta CNAEs na Receita.
Ações que mudam algo viram um cartão de aprovação (Aprovar/Recusar): salvar/remover licitação e alterar_dados (catálogo, clientes, contratações, alertas, sistemas de licitação, etapa/observações de licitações salvas, nome/tipo/datas de documentos, configuração de proposta).
Não faz: enviar proposta em plataforma, emitir/cancelar nota fiscal, alterar dados da empresa, ver senhas/tokens, mandar mensagens para terceiros. Conversas ficam salvas no histórico (com busca).`,

  fluxo_completo: `Fluxo de ponta a ponta:
1. Busca → Salvar (ou alertas salvam sozinhos) → etapa Oportunidade.
2. Detalhe → baixar edital / CSV de itens → Criar proposta (análise do edital × acervo) → preços e marcas (ou planilha) → Salvar rascunho → Exportar PDF → Baixar declarações. Mudar para Proposta Pronta é manual.
3. Assinar no gov.br → Importar assinado / Importar proposta final.
4. Enviar proposta: checklist, ZIP de habilitação, copiar valores, abrir a plataforma; o usuário envia lá e clica "Marcar como enviada" (etapa Proposta Enviada). Lembretes 24h/3h antes do prazo.
5. Resultado: Vencida → cliente + contratação + edital anexado; Perdida → só muda a etapa.
6. Cliente/contratação: dados do órgão por CNPJ, empenho, contrato.
7. Nota fiscal: rascunho ligado à contratação → Emitir → DANFE/XML anexados ao cliente.`,
};

export const TOPICOS_MANUAL = Object.keys(MANUAL);

export function manualDoSistema(topico: string): string {
  return MANUAL[topico] ?? `Tópico desconhecido. Tópicos: ${TOPICOS_MANUAL.join(", ")}.`;
}
