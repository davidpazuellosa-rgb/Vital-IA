# Vita — a assistente de IA do Vital.IA

A Vita reúne **todas as ferramentas de IA do sistema numa conversa**: analisar documentos da
empresa, editais e itens, montar propostas, conversar sobre os **produtos e serviços** da Vital
Norte e **executar ações no sistema — sempre com aprovação** de quem está usando.

---

## 1. Interface

- **Botão “Vita”** no canto direito da top bar (ícone + nome). Atalho de teclado: ⌘J.
- **Painel à direita**, ~420 px (redimensionável arrastando a borda; largura lembrada).
- **Abre e fecha com transição fina** (~300 ms, curva suave): o painel desliza da direita e
  **empurra o conteúdo** — a página encolhe para dar espaço, nada fica coberto. Fechar devolve
  o espaço com a mesma animação. Respeita “reduzir movimento” do sistema operacional.
- No celular, o painel ocupa a tela inteira.
- **Conversa com resposta em tempo real** (texto aparecendo enquanto a Vita escreve), formatação
  (listas, tabelas), e **cartões** para licitações, documentos, itens e propostas, com botões.
- **Contexto da página:** aberta numa licitação, a Vita já sabe de qual licitação se trata
  (“monte a proposta desta”), e o mesmo vale para cliente, documento ou proposta.

## 2. Anexos (até 8 por mensagem)

- **Tipos:** PDF (texto ou escaneado), imagens e fotos (JPG, PNG, HEIC, WEBP), planilhas
  (XLSX, XLS, CSV), Word (DOCX) e texto. Até **20 MB por arquivo**.
- **Como anexar:** clipe, arrastar e soltar no painel, ou colar imagem (Cmd+V).
- **Como a Vita lê:** PDF → texto (e OCR por IA se for escaneado, como já acontece na análise
  de edital); imagem/foto → leitura por IA com visão; planilha → tabela (linhas e colunas);
  DOCX → texto.
- **Onde ficam:** numa pasta temporária da conversa. **Só entram no acervo da empresa, de um
  cliente ou de uma proposta se você aprovar** a ação de anexar (ver item 5).

## 3. O que a Vita sabe (contexto)

| Fonte | Para quê |
|---|---|
| Dados da empresa (razão social, CNAE, porte, endereço) | saber o que a Vital Norte pode vender e como se apresenta |
| **Catálogo de produtos e serviços** *(novo)* | conversar sobre os seus produtos, preços de referência, marcas, fornecedores |
| CNAEs (principal e secundários, pela Receita) | dizer que serviços a empresa **pode** prestar e quais oportunidades exigem outro CNAE |
| Documentos do acervo e validades | habilitação, vencimentos, o que falta |
| Licitações salvas, propostas, itens e preços já usados | histórico e preços praticados |
| Clientes, contratações e notas fiscais emitidas | o que já foi vendido, para quem e por quanto |
| PNCP ao vivo | buscar licitações, ler editais e itens |

**Catálogo de produtos e serviços (nova página):** nome, descrição, categoria, unidade, marca,
código (CATMAT/CATSER/NCM), custo, preço de referência, margem, fornecedores e observações. A Vita
ajuda a montar o catálogo a partir das notas, propostas e conversas — cada item criado com aprovação.

## 4. Ferramentas da Vita

**Leitura (não alteram nada — executam direto):**
- buscar licitações (PNCP ao vivo, com todos os filtros da Busca);
- abrir uma licitação: itens, valores, arquivos do edital;
- analisar edital (documentos exigidos/dispensados, declarações, condições);
- ler e extrair dados de anexos (tabelas de preços, itens, validades de certidões);
- consultar acervo de documentos, empresa, clientes, contratações, propostas e notas;
- consultar o catálogo e **casar itens do edital com produtos do catálogo** (sugere marca e preço);
- calcular preço (custo + margem + impostos) e comparar com o valor estimado.

**Ações (alteram o sistema — sempre pedem aprovação):**
- salvar licitação em Minhas Licitações e mudar etapa;
- **remover licitação salva** (o cartão avisa se há rascunho de proposta, que é removido junto);
- criar ou atualizar **rascunho de proposta** (itens, marcas, preços);
- gerar o **PDF da proposta** e das declarações;
- **anexar documento** ao acervo (com tipo e validade extraídos), a um cliente ou contratação;
- criar ou editar itens do **catálogo**;
- registrar envio de proposta; criar alerta de licitações.

**Fora do alcance da Vita (decisão de segurança):** transmitir NF-e, cancelar nota, excluir
qualquer outra coisa (documentos, clientes, propostas enviadas), enviar proposta na plataforma, mudar dados da empresa ou configurações, enviar
mensagens a terceiros.

## 5. Aprovação

1. Quando a Vita quer fazer algo, aparece um **cartão de aprovação** na conversa: o que será
   feito, onde, e **o que muda** (antes → depois, valores, arquivos).
2. Botões **Aprovar**, **Editar** (ajustar antes de aprovar) e **Recusar**. Nada acontece antes do clique.
3. Várias ações de uma vez (ex.: 12 itens de proposta) aparecem como lista: aprovar todas ou uma a uma.
4. A ação roda **com o seu login** (mesmas permissões que você tem na tela — a Vita não tem acesso
   especial).
5. Tudo fica num **histórico de ações** (quem aprovou, quando, o que mudou, resultado), com
   **desfazer** quando possível.
6. **Proteção contra instruções escondidas:** texto de editais, PDFs e planilhas é tratado como
   dado, nunca como ordem. Se um documento “mandar” a Vita fazer algo, ela não faz — e avisa.

## 6. Como funciona por dentro

- Conversa via rota do servidor com resposta em tempo real; a Vita decide quais ferramentas usar.
- Ferramentas de leitura rodam no servidor; ferramentas de ação **não rodam**: viram um pedido
  pendente, exibido como cartão. Ao aprovar, o servidor executa com a sessão do usuário e devolve o
  resultado para a conversa continuar.
- **Modelo de IA:** decidido na Fase 0 (ver decisões). Precisa suportar ferramentas (function
  calling), visão (imagens/PDF escaneado) e resposta em tempo real.
- **Custo controlado:** modelo rápido para conversa e leitura; modelo forte para análise de edital
  e montagem de proposta; limite de tamanho por anexo e por conversa.

## 7. Fases

| Fase | Entrega | Resultado para você |
|---|---|---|
| **0** | Prova técnica do modelo: ferramentas + visão + tempo real; custo por conversa | escolha do modelo com números reais |
| **1** | Botão na top bar, painel com transição que empurra a página, conversa em tempo real, contexto da empresa | já dá para conversar com a Vita |
| **2** | Anexos (até 8): PDF, OCR, imagens, planilhas, DOCX | “leia esta tabela de preços / esta certidão” |
| **3** | Ferramentas de leitura: licitações, editais, itens, acervo, propostas, notas | “ache pregões de alimentos no AM e me diga quais posso atender” |
| **4** | Catálogo de produtos/serviços + CNAEs + casar edital × catálogo | “quais itens deste edital eu tenho? com que margem?” |
| **5** | Ações com aprovação + histórico + desfazer | “monte a proposta e anexe esta certidão” → você aprova |
| **6** | Refinos: conversas salvas e pesquisáveis, sugestões por página, atalhos | uso diário mais rápido |

Cada fase é publicada e testada antes da próxima.

---

## Decisões (2026-10-09)

- **Modelo: DeepSeek.** Fase 0 aprovada: ferramentas (inclusive várias na mesma resposta), com e sem
  raciocínio, Flash e Pro, streaming com ferramentas (1º pedaço em 0,34 s) e imagem junto de ferramentas.
- **Conversas: guardar todas, com busca.**
- **Catálogo: página própria + a Vita ajuda a preencher (com aprovação).**
- **A Vita busca licitações sozinha, salva e remove licitações salvas** (as duas últimas com aprovação) —
  antecipado para a Fase 1.

---

## Harness de busca (2026-10-09)

**Objetivo:** a Vita não responde "de cabeça" nem só do cadastro. Ela sabe **o que existe e onde está** (mapa) e
segue um roteiro: fonte mais confiável → confirmação numa segunda fonte → resposta com a fonte citada.
Caso-guia: **CNPJ e dados da empresa** vêm dos **documentos** (Cartão CNPJ, contrato social), comparados com o
cadastro de Dados da Empresa; divergência é apontada e a Vita oferece corrigir.

### Peças
| Peça | Onde | O que faz |
|---|---|---|
| **Mapa do sistema** | `src/lib/vita/mapa.ts` | Assunto → fontes em ordem de confiança (documentos, tabelas, ferramentas, páginas, externas) + lista de páginas. 25 assuntos em 9 áreas. |
| **Mapa da empresa** | tabela `vita_mapa`, `mapa-servidor.ts` | Assuntos próprios somados ao padrão; assuntos padrão podem ser desligados (`vita_configuracao.mapa_desativados`). Editável na aba **Mapa** de `/vita`. |
| **`onde_encontrar`** | `harness.ts` | Consulta o mapa efetivo (padrão + empresa) e devolve o roteiro. |
| **`buscar_informacao`** | `harness.ts` | Para campos da empresa: lê os documentos certos, extrai (rótulos do Cartão CNPJ + regex), **compara com o cadastro** e devolve `confirmado / DIVERGENTE / só no cadastro / só nos documentos / não encontrado`, com documento e trecho de cada valor. Campos: CNPJ (com dígito verificador), razão social, fantasia, porte, natureza, abertura, CNAEs, endereço, telefone, e-mail, situação, IE/IM, capital social, sócios, dados bancários, ou "dados cadastrais" (tudo do Cartão). |
| **`pesquisar_documentos`** | `harness.ts` | Busca por termos no **conteúdo** de acervo e/ou clientes; devolve trechos + id para `ler_documento`. |
| **Índice de texto** | tabela `documentos_texto` | Cada arquivo é lido uma vez (`lerAnexo`, com OCR) e o texto fica guardado; refeito se `arquivo_path` mudar. Limite por busca: 8 novos (acervo) / 6 (clientes), 40 s. |

### Regras (também nas instruções da Vita)
1. Dados da empresa: **sempre** `buscar_informacao`; nunca só do cadastro nem de memória; citar o documento.
2. Informação dentro de documentos: `pesquisar_documentos`; arquivo inteiro: `ler_documento`.
3. Não sabe onde está: `onde_encontrar`. Dado importante (CNPJ, valores, prazos): confirmar em segunda fonte.
4. Não achou: dizer o que procurou e onde; sugerir enviar o documento que falta. Nunca inventar.
5. **CPFs saem mascarados** (`•••.•••.•••-NN`). Fotos/imagens não entram na busca por texto.

### Como estender
- **Assunto novo (sem código):** aba Mapa → "Adicionar assunto" (área, palavras, fontes em ordem, dica).
- **Assunto novo (no código):** acrescentar em `MAPA` (`mapa.ts`). Tela, tabela ou tipo de documento novo ⇒ atualizar o mapa.
- **Campo novo da empresa:** acrescentar em `CAMPOS` (`harness.ts`): tipos de documento, coluna do cadastro e extrator.
- **Ferramenta nova:** registrar em `ferramentas.ts` **e** em `catalogo-ferramentas.ts` (aparece na aba Ferramentas).

### Verificação feita
Em produção, com empresa de teste (Cartão CNPJ e contrato social gerados no layout da Receita; cadastro divergente de propósito): CNPJ achado nos dois documentos e divergência apontada com as fontes; extração de porte, CNAEs, endereço e contato; capital social e sócios do contrato (CPFs mascarados); busca livre por "quotas"/"assinam isoladamente"; mapa para portal/validade de certidões; índice persistido.
**Limite conhecido:** o leitor do Cartão CNPJ segue os rótulos do layout oficial; PDF de formato diferente pode exigir ajuste dos rótulos.
