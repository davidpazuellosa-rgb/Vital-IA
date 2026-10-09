import type { SupabaseClient } from "@supabase/supabase-js";
import { avaliarValidade, nomeTipo, tipoSemValidade } from "@/lib/documentos/types";
import { formatarMoeda } from "@/lib/format";
import { buscarCompraPncp, buscarItensPncp } from "@/lib/licitacoes/providers/pncp-itens";
import { linkPncp } from "@/lib/licitacoes/pncp-url";
import { buscarLicitacoes } from "@/lib/licitacoes/registry";
import { lerAnexo } from "./anexos";
import { consultarDados, NOMES_TABELAS, proporAlteracao, TABELAS_ALTERAVEIS } from "./banco";
import { manualDoSistema, TOPICOS_MANUAL } from "./manual";
import { proporNotaFiscal, proporProposta } from "./rascunhos";
import { esquecer, memorizar } from "./memoria";
import { MAX_OPCOES, montarPergunta, type PerguntaVita } from "./pergunta";
import { IDS_CATEGORIA } from "./catalogo-ferramentas";
import {
  ETAPAS_LICITACAO, MODALIDADES, PLATAFORMAS, UFS, normalizarEtapa,
  type PlatformId, type UnifiedLicitacao, type UniversalFilter,
} from "@/lib/licitacoes/types";

/* ---------------------------------------------------------------------------------------------
 * Ferramentas da Vita (formato de "function calling" do DeepSeek / OpenAI).
 *  - LEITURA: executam na hora, com a sessão do usuário (mesmas permissões da tela).
 *  - AÇÃO: não executam. Viram um pedido "pendente" que o usuário aprova ou recusa num cartão.
 * ------------------------------------------------------------------------------------------- */

export type DetalheAcao = { rotulo: string; valor: string };
export type AcaoProposta = {
  tipo: "salvar_licitacao" | "remover_licitacao_salva" | "alterar_dados" | "rascunho_nota_fiscal" | "preencher_proposta";
  parametros: Record<string, unknown>;
  resumo: string;
  detalhes: DetalheAcao[];
  aviso?: string;
};

export type ContextoFerramenta = {
  supabase: SupabaseClient;
  userId: string;
  /** Licitações vistas na conversa, por nº de controle (persistido em vita_conversas.dados). */
  vistas: Record<string, UnifiedLicitacao>;
  /** Conversa atual (para registrar de onde nasceu uma memória). */
  conversaId?: string | null;
};

export type ResultadoFerramenta = { paraModelo: string; acao?: AcaoProposta; pergunta?: PerguntaVita };

const ID_PLATAFORMAS = PLATAFORMAS.map((p) => p.id);
const LISTA_MODALIDADES = MODALIDADES.map((m) => `${m.id}=${m.nome}`).join("; ");

export const FERRAMENTAS = [
  {
    type: "function",
    function: {
      name: "buscar_licitacoes",
      description:
        "Busca licitações AO VIVO no PNCP (Portal Nacional de Contratações Públicas). Use para qualquer pergunta sobre oportunidades. " +
        "Aceita palavra-chave (ignora acentos; aspas = frase exata) e/ou nº de controle PNCP (ex.: 04407029000143-1-000043/2026), órgão, estados, modalidades e plataforma.",
      parameters: {
        type: "object",
        properties: {
          palavra_chave: { type: "string", description: "Objeto procurado, ex.: \"gêneros alimentícios\". Opcional." },
          orgao: { type: "string", description: "Nome do órgão, ex.: \"Município de Manaus\". Opcional." },
          ufs: { type: "array", items: { type: "string", enum: [...UFS] }, description: "Siglas dos estados. Opcional." },
          modalidades: { type: "array", items: { type: "integer" }, description: `Códigos: ${LISTA_MODALIDADES}. Opcional.` },
          plataforma: { type: "string", enum: ID_PLATAFORMAS, description: "Sistema onde a licitação acontece. Padrão: pncp (todas)." },
          apenas_abertas: { type: "boolean", description: "Só as que ainda recebem propostas. Padrão: true." },
          publicadas_nos_ultimos_dias: { type: "integer", description: "Só vale com apenas_abertas=false. Padrão: 30." },
          pagina: { type: "integer", description: "Página de resultados (10 por página). Padrão: 1." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detalhar_licitacao",
      description: "Mostra os dados e os ITENS (descrição, quantidade, unidade, valor estimado, cota ME/EPP) de uma licitação do PNCP.",
      parameters: {
        type: "object",
        properties: { numero_controle_pncp: { type: "string", description: "Ex.: 04407029000143-1-000043/2026" } },
        required: ["numero_controle_pncp"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_licitacoes_salvas",
      description: "Lista as licitações salvas pelo usuário em \"Minhas Licitações\", com etapa, prazo e situação da proposta.",
      parameters: {
        type: "object",
        properties: {
          etapa: { type: "string", enum: ETAPAS_LICITACAO.map((e) => e.slug), description: "Filtra pela etapa. Opcional." },
          encerrando_em_dias: { type: "integer", description: "Só as que encerram nos próximos N dias. Opcional." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_empresa",
      description: "Dados cadastrais da empresa do usuário (razão social, CNPJ, porte, CNAE, endereço, contato).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_documentos",
      description: "Documentos de habilitação do acervo da empresa (certidões etc.) com validade e situação (válido, vencendo, vencido).",
      parameters: {
        type: "object",
        properties: { somente_problemas: { type: "boolean", description: "Só vencidos ou vencendo. Padrão: false." } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_licitacao",
      description:
        "PROPÕE salvar uma licitação em \"Minhas Licitações\". NÃO executa: o usuário aprova ou recusa num cartão. " +
        "Use o nº de controle de uma licitação mostrada antes por buscar_licitacoes ou detalhar_licitacao.",
      parameters: {
        type: "object",
        properties: { numero_controle_pncp: { type: "string" } },
        required: ["numero_controle_pncp"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remover_licitacao_salva",
      description:
        "PROPÕE remover uma licitação de \"Minhas Licitações\" (e o rascunho de proposta dela, se houver). NÃO executa: o usuário aprova num cartão.",
      parameters: {
        type: "object",
        properties: { numero_controle_pncp: { type: "string" } },
        required: ["numero_controle_pncp"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_dados",
      description:
        "Consulta QUALQUER dado do sistema no banco (somente leitura, com as permissões do usuário): clientes, contratações, propostas, " +
        "notas fiscais, alertas, catálogo de produtos/serviços, documentos, sistemas de licitação, configurações etc. " +
        "Veja as tabelas e colunas nas instruções. Filtros: eq, neq, gt, gte, lt, lte, contem (texto, ignora maiúsculas), vazio (valor true=é nulo, false=não é nulo), em (lista).",
      parameters: {
        type: "object",
        properties: {
          tabela: { type: "string", enum: NOMES_TABELAS },
          colunas: { type: "array", items: { type: "string" }, description: "Opcional; padrão: todas as permitidas." },
          filtros: {
            type: "array",
            items: {
              type: "object",
              properties: {
                coluna: { type: "string" },
                operador: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "contem", "vazio", "em"] },
                valor: { description: "Texto, número, booleano ou lista (para \"em\")." },
              },
              required: ["coluna", "operador"],
            },
          },
          ordenar_por: { type: "string" },
          decrescente: { type: "boolean" },
          limite: { type: "integer", description: "1 a 100. Padrão: 30." },
        },
        required: ["tabela"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "alterar_dados",
      description:
        "PROPÕE cadastrar, alterar ou remover registros no banco. NÃO executa: o usuário vê um cartão com o antes → depois e aprova ou recusa. " +
        `Tabelas alteráveis: ${TABELAS_ALTERAVEIS.join(", ")} (colunas e operações permitidas nas instruções). ` +
        "Para atualizar/remover, consulte antes com consultar_dados para obter o id. Para cadastrar vários itens de uma vez, mande uma lista em dados (até 50).",
      parameters: {
        type: "object",
        properties: {
          tabela: { type: "string", enum: TABELAS_ALTERAVEIS },
          operacao: { type: "string", enum: ["inserir", "atualizar", "remover"] },
          id: { type: "string", description: "id da linha (atualizar/remover). Não use em proposta_configuracao." },
          dados: { description: "Objeto coluna → valor (inserir/atualizar). Para inserir vários, uma lista de objetos." },
          motivo: { type: "string", description: "Explicação curta exibida no cartão." },
        },
        required: ["tabela", "operacao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rascunho_nota_fiscal",
      description:
        "PROPÕE criar (sem id) ou alterar (com id) um RASCUNHO de nota fiscal. NÃO executa nem emite: o usuário aprova num cartão, e a emissão é sempre feita por ele na tela. " +
        "Com cliente_id e sem destinatario, usa os dados do órgão salvos no cliente. Exige endereço completo, CEP de 8 dígitos, NCM (8 dígitos) e CFOP (4 dígitos; 5xxx dentro do AM, 6xxx fora).",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "id do rascunho a alterar (consulte em notas_fiscais). Omitir para criar." },
          cliente_id: { type: "string" },
          contratacao_id: { type: "string" },
          natureza_operacao: { type: "string", description: "Padrão: Venda de mercadoria." },
          observacoes: { type: "string" },
          destinatario: {
            type: "object",
            properties: {
              nome: { type: "string" }, documento: { type: "string", description: "CNPJ ou CPF" }, ie: { type: "string" },
              ind_ie: { type: "integer", description: "1 contribuinte, 2 isento, 9 não contribuinte" },
              cep: { type: "string" }, logradouro: { type: "string" }, numero: { type: "string" }, bairro: { type: "string" },
              municipio: { type: "string" }, uf: { type: "string" },
            },
          },
          itens: {
            type: "array",
            description: "Lista COMPLETA de itens da nota (substitui a atual).",
            items: {
              type: "object",
              properties: {
                descricao: { type: "string" }, ncm: { type: "string" }, cfop: { type: "string" }, unidade: { type: "string" },
                quantidade: { type: "number" }, valor_unitario: { type: "number" },
              },
              required: ["descricao", "ncm", "cfop", "quantidade", "valor_unitario"],
            },
          },
          motivo: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preencher_proposta",
      description:
        "PROPÕE preencher o RASCUNHO da proposta de uma licitação salva: marca, valor unitário e se o item entra na proposta. NÃO executa: o usuário aprova num cartão. " +
        "Se ainda não houver rascunho, parte dos itens do PNCP. Envie só os itens que mudam. Nunca altera proposta já enviada.",
      parameters: {
        type: "object",
        properties: {
          numero_controle_pncp: { type: "string" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                numero_item: { type: "integer" }, marca: { type: "string" }, valor_unitario: { type: "number" }, selecionado: { type: "boolean" },
              },
              required: ["numero_item"],
            },
          },
          motivo: { type: "string" },
        },
        required: ["numero_controle_pncp", "itens"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ler_documento",
      description:
        "Lê o CONTEÚDO (texto) de um arquivo guardado no sistema: do acervo (tabela documentos) ou de clientes/contratações (tabela cliente_documentos). " +
        "Obtenha o id com consultar_dados ou consultar_documentos. PDFs escaneados passam por OCR (pode demorar).",
      parameters: {
        type: "object",
        properties: {
          origem: { type: "string", enum: ["documentos", "cliente_documentos"] },
          id: { type: "string" },
        },
        required: ["origem", "id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_cnaes",
      description:
        "Consulta na Receita Federal (via BrasilAPI) o CNAE principal e TODOS os CNAEs secundários de um CNPJ — por padrão o da própria empresa. " +
        "Use para dizer em que ramos a empresa pode atuar e se um objeto de licitação é compatível.",
      parameters: { type: "object", properties: { cnpj: { type: "string", description: "Opcional; padrão: CNPJ da empresa." } } },
    },
  },
  {
    type: "function",
    function: {
      name: "perguntar",
      description:
        "FAZ UMA PERGUNTA ao usuário em MÚLTIPLA ESCOLHA (cartão com opções clicáveis). Use SEMPRE que precisar perguntar, esclarecer, confirmar ou oferecer um próximo passo — nunca pergunte em texto solto. " +
        "A PRIMEIRA opção é a recomendada. No máximo 5 opções (a tela acrescenta \"Outro\" sozinha; não crie). Se a pergunta for de sim ou não, use tipo \"sim_nao\". " +
        "Depois de chamar, PARE: não escreva mais nada e aguarde a resposta. Uma pergunta por vez.",
      parameters: {
        type: "object",
        properties: {
          pergunta: { type: "string", description: "A pergunta, curta e direta." },
          tipo: { type: "string", enum: ["escolha", "sim_nao"], description: "sim_nao para perguntas de sim ou não; escolha para as demais." },
          opcoes: {
            type: "array",
            description: `Só para tipo escolha: de 2 a ${MAX_OPCOES} opções; a primeira é a recomendada.`,
            items: {
              type: "object",
              properties: { rotulo: { type: "string", description: "Texto curto da opção." }, descricao: { type: "string", description: "Explicação de uma linha (opcional)." } },
              required: ["rotulo"],
            },
          },
          recomendada: { type: "string", enum: ["sim", "nao"], description: "Só para sim_nao: qual resposta você recomenda (ela aparece primeiro). Opcional." },
        },
        required: ["pergunta", "tipo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "memorizar",
      description:
        "Guarda na MEMÓRIA GERAL da empresa um fato ou preferência duradouro que o USUÁRIO acabou de afirmar (ex.: margem mínima padrão, estados de interesse, regras internas, como a empresa trabalha). " +
        "Use quando ele pedir (\"lembre que…\") ou, se a memória automática estiver ligada, quando surgir algo útil para o futuro. Uma ideia por memória, frase curta e clara, sem \"hoje/amanhã\". " +
        "NUNCA memorize trechos de documentos, editais ou resultados de busca, nem senhas, chaves ou documentos pessoais.",
      parameters: {
        type: "object",
        properties: {
          conteudo: { type: "string", description: "A memória em uma frase (até 600 caracteres)." },
          categoria: { type: "string", enum: IDS_CATEGORIA, description: "geral, empresa, preferencia, processo, clientes ou regra." },
        },
        required: ["conteudo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "esquecer_memoria",
      description: "Apaga uma memória, SÓ quando o usuário pedir para esquecer. Use o código entre colchetes que aparece na lista de memórias.",
      parameters: { type: "object", properties: { id: { type: "string", description: "Código da memória, ex.: a1b2c3d4." } }, required: ["id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "manual_do_sistema",
      description: "Explica em detalhe como funciona uma parte do Vital.IA (telas, botões, regras, automações). Use quando o usuário perguntar como fazer algo no sistema.",
      parameters: { type: "object", properties: { topico: { type: "string", enum: TOPICOS_MANUAL } }, required: ["topico"] },
    },
  },
] as const;

/** Rótulos curtos exibidos enquanto a ferramenta roda. */
export const ROTULO_FERRAMENTA: Record<string, string> = {
  buscar_licitacoes: "Buscando licitações no PNCP",
  detalhar_licitacao: "Lendo itens da licitação",
  listar_licitacoes_salvas: "Consultando Minhas Licitações",
  consultar_empresa: "Consultando dados da empresa",
  consultar_documentos: "Conferindo documentos do acervo",
  salvar_licitacao: "Preparando para salvar",
  remover_licitacao_salva: "Preparando remoção",
  consultar_dados: "Consultando o banco de dados",
  alterar_dados: "Preparando alteração",
  ler_documento: "Lendo documento",
  consultar_cnaes: "Consultando CNAEs na Receita",
  manual_do_sistema: "Consultando o manual do sistema",
  perguntar: "Preparando uma pergunta",
  memorizar: "Guardando na memória",
  esquecer_memoria: "Apagando da memória",
  rascunho_nota_fiscal: "Preparando rascunho da nota fiscal",
  preencher_proposta: "Preparando o rascunho da proposta",
};

/* ------------------------------------------------------------------------------------------- */

const dataBr = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const dataHoraBr = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Manaus" }) : "—";
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const json = (v: unknown) => JSON.stringify(v);
const nomePlataforma = (id: string) => PLATAFORMAS.find((p) => p.id === id)?.nome ?? id;
/** O PNCP usa 0 quando não informa o valor (ou quando é sigiloso). */
const valorOuNaoInformado = (v: number | null | undefined) => (v && v > 0 ? formatarMoeda(v) : "Não informado");
/** Página da licitação no próprio sistema: a salva (com ações) ou a do PNCP (antes de salvar). */
export const linkSistema = (numero: string, idSalva?: string | null) =>
  idSalva ? `/licitacao/${idSalva}` : `/licitacao/pncp?n=${encodeURIComponent(numero)}`;

function resumoLicitacao(l: UnifiedLicitacao, salvas: Map<string, string>) {
  return {
    numero_controle_pncp: l.numeroControlePNCP,
    objeto: (l.titulo || l.descricao).slice(0, 220),
    orgao: l.orgao,
    local: [l.municipio, l.uf].filter(Boolean).join("/"),
    modalidade: l.modalidade,
    valor_estimado: l.valorEstimado && l.valorEstimado > 0 ? l.valorEstimado : "não informado",
    encerramento_propostas: dataHoraBr(l.dataEncerramentoProposta),
    plataforma: nomePlataforma(l.plataforma),
    link_origem: l.linkOrigem,
    ja_salva: salvas.has(l.numeroControlePNCP),
    link_sistema: linkSistema(l.numeroControlePNCP, salvas.get(l.numeroControlePNCP)),
    link_pncp: linkPncp(l.numeroControlePNCP),
  };
}

/** Nº de controle → id da licitação salva (só as que estão em Minhas Licitações). */
async function numerosSalvos(ctx: ContextoFerramenta, numeros: string[]): Promise<Map<string, string>> {
  if (!numeros.length) return new Map();
  const { data } = await ctx.supabase.from("saved_licitacoes").select("id, numero_controle_pncp").in("numero_controle_pncp", numeros);
  return new Map((data ?? []).map((r) => [String(r.numero_controle_pncp), String(r.id)]));
}

type Args = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const inteiro = (v: unknown, padrao: number) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : padrao);

async function buscar(args: Args, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  const plataforma = ID_PLATAFORMAS.includes(texto(args.plataforma) as PlatformId) ? (texto(args.plataforma) as PlatformId) : "pncp";
  const ufs = Array.isArray(args.ufs) ? args.ufs.map(String).filter((u) => (UFS as readonly string[]).includes(u)) : [];
  const modalidades = Array.isArray(args.modalidades) ? args.modalidades.map(Number).filter((n) => MODALIDADES.some((m) => m.id === n)) : [];
  const dias = inteiro(args.publicadas_nos_ultimos_dias, 30);
  const filtro: UniversalFilter = {
    keyword: texto(args.palavra_chave) || undefined,
    orgao: texto(args.orgao) || undefined,
    ufs: ufs.length ? ufs : undefined,
    modalidades: modalidades.length ? modalidades : undefined,
    dataInicial: ymd(new Date(Date.now() - dias * 86_400_000)),
    dataFinal: ymd(new Date()),
    plataformas: [plataforma],
    apenasAberto: args.apenas_abertas !== false,
  };
  const pagina = inteiro(args.pagina, 1);
  const r = await buscarLicitacoes(filtro, { pagina, tamanhoPagina: 10 });
  for (const l of r.itens) ctx.vistas[l.numeroControlePNCP] = l;
  const salvas = await numerosSalvos(ctx, r.itens.map((l) => l.numeroControlePNCP));
  return {
    paraModelo: json({
      total_encontrado: r.totalRegistros,
      pagina,
      total_paginas: r.totalPaginas,
      resultado_parcial: Boolean(r.incompleto),
      aviso: r.aviso ?? null,
      licitacoes: r.itens.map((l) => resumoLicitacao(l, salvas)),
    }),
  };
}

async function detalhar(args: Args, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  const numero = texto(args.numero_controle_pncp);
  if (!numero) return { paraModelo: json({ erro: "Informe o nº de controle PNCP." }) };
  const [compra, itens] = await Promise.all([buscarCompraPncp(numero), buscarItensPncp(numero)]);
  const lic = compra ?? ctx.vistas[numero] ?? null;
  if (lic) ctx.vistas[numero] = lic;
  if (!lic && !itens.length) return { paraModelo: json({ erro: "Não encontrei essa licitação no PNCP (ou o portal está instável)." }) };
  const salvas = await numerosSalvos(ctx, [numero]);
  return {
    paraModelo: json({
      licitacao: lic ? resumoLicitacao(lic, salvas) : { numero_controle_pncp: numero, link_sistema: linkSistema(numero, salvas.get(numero)), link_pncp: linkPncp(numero) },
      descricao_completa: lic?.descricao?.slice(0, 1500) ?? null,
      total_itens: itens.length,
      itens: itens.slice(0, 40).map((i) => ({
        item: i.numeroItem,
        descricao: i.descricao.slice(0, 160),
        quantidade: i.quantidade,
        unidade: i.unidadeMedida,
        valor_unitario_estimado: i.valorUnitarioEstimado,
        valor_total: i.valorTotal,
        beneficio: i.tipoBeneficioNome,
      })),
      itens_omitidos: Math.max(0, itens.length - 40),
    }),
  };
}

async function listarSalvas(args: Args, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  let q = ctx.supabase
    .from("saved_licitacoes")
    .select("id, numero_controle_pncp, titulo, orgao, uf, municipio, etapa, valor_estimado, data_encerramento_proposta")
    .order("data_encerramento_proposta", { ascending: true, nullsFirst: false })
    .limit(60);
  const etapa = texto(args.etapa);
  if (etapa) q = q.eq("etapa", etapa);
  const dias = Number.isInteger(args.encerrando_em_dias) ? (args.encerrando_em_dias as number) : null;
  if (dias != null) {
    q = q.gte("data_encerramento_proposta", new Date().toISOString()).lte("data_encerramento_proposta", new Date(Date.now() + dias * 86_400_000).toISOString());
  }
  const { data, error } = await q;
  if (error) return { paraModelo: json({ erro: error.message }) };
  const ids = (data ?? []).map((l) => l.id);
  const { data: propostas } = ids.length
    ? await ctx.supabase.from("propostas").select("licitacao_id, status").in("licitacao_id", ids)
    : { data: [] };
  const porLic = new Map((propostas ?? []).map((p) => [String(p.licitacao_id), String(p.status)]));
  return {
    paraModelo: json({
      total: data?.length ?? 0,
      licitacoes: (data ?? []).map((l) => ({
        numero_controle_pncp: l.numero_controle_pncp,
        objeto: String(l.titulo ?? "").slice(0, 160),
        orgao: l.orgao,
        local: [l.municipio, l.uf].filter(Boolean).join("/"),
        etapa: ETAPAS_LICITACAO.find((e) => e.slug === normalizarEtapa(l.etapa))?.nome ?? l.etapa,
        valor_estimado: l.valor_estimado,
        encerramento_propostas: dataHoraBr(l.data_encerramento_proposta),
        proposta: porLic.get(String(l.id)) === "enviada" ? "enviada" : porLic.has(String(l.id)) ? "rascunho" : "não iniciada",
        link_sistema: linkSistema(String(l.numero_controle_pncp), String(l.id)),
        link_pncp: linkPncp(String(l.numero_controle_pncp)),
      })),
    }),
  };
}

async function empresa(ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  const { data } = await ctx.supabase.from("empresa").select("*").limit(1).maybeSingle();
  if (!data) return { paraModelo: json({ erro: "Dados da empresa ainda não cadastrados (página Dados da Empresa)." }) };
  const campos = ["razao_social", "nome_fantasia", "cnpj", "porte", "natureza_juridica", "cnae_principal", "data_abertura",
    "inscricao_estadual", "inscricao_municipal", "email", "telefone", "logradouro", "numero", "bairro", "municipio", "uf", "cep"];
  return { paraModelo: json(Object.fromEntries(campos.map((c) => [c, data[c] ?? null]))) };
}

async function documentos(args: Args, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  const { data, error } = await ctx.supabase
    .from("documentos")
    .select("tipo, nome, data_emissao, data_validade")
    .order("created_at", { ascending: false });
  if (error) return { paraModelo: json({ erro: error.message }) };
  const lista = (data ?? []).map((d) => {
    const semValidade = tipoSemValidade(d.tipo);
    const v = avaliarValidade(d.data_validade);
    return {
      tipo: nomeTipo(d.tipo),
      nome: d.nome,
      validade: semValidade ? "não se aplica" : dataBr(d.data_validade),
      situacao: semValidade ? "sem validade" : v.rotulo,
      dias_restantes: semValidade ? null : v.diasRestantes,
      problema: !semValidade && (v.status === "vencido" || v.status === "vence_em_breve"),
    };
  });
  const filtrada = args.somente_problemas === true ? lista.filter((d) => d.problema) : lista;
  return { paraModelo: json({ total: filtrada.length, documentos: filtrada }) };
}

async function proporSalvar(args: Args, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  const numero = texto(args.numero_controle_pncp);
  if (!numero) return { paraModelo: json({ erro: "Informe o nº de controle PNCP." }) };
  if ((await numerosSalvos(ctx, [numero])).size) {
    return { paraModelo: json({ resultado: "Essa licitação já está em Minhas Licitações. Nada a fazer." }) };
  }
  const lic = ctx.vistas[numero] ?? (await buscarCompraPncp(numero));
  if (!lic) return { paraModelo: json({ erro: "Não tenho os dados dessa licitação. Busque-a primeiro com buscar_licitacoes." }) };
  ctx.vistas[numero] = lic;
  return {
    paraModelo: json({ resultado: "PENDENTE: pedido de aprovação exibido ao usuário num cartão. Ainda NÃO foi salva — não diga que foi." }),
    acao: {
      tipo: "salvar_licitacao",
      parametros: { licitacao: lic },
      resumo: "Salvar licitação em Minhas Licitações",
      detalhes: [
        { rotulo: "Objeto", valor: (lic.titulo || lic.descricao).slice(0, 180) },
        { rotulo: "Órgão", valor: `${lic.orgao}${lic.uf ? ` · ${[lic.municipio, lic.uf].filter(Boolean).join("/")}` : ""}` },
        { rotulo: "Modalidade", valor: lic.modalidade || "—" },
        { rotulo: "Valor estimado", valor: valorOuNaoInformado(lic.valorEstimado) },
        { rotulo: "Propostas até", valor: dataHoraBr(lic.dataEncerramentoProposta) },
        { rotulo: "Nº PNCP", valor: numero },
      ],
    },
  };
}

async function proporRemover(args: Args, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  const numero = texto(args.numero_controle_pncp);
  if (!numero) return { paraModelo: json({ erro: "Informe o nº de controle PNCP." }) };
  const { data: linhas } = await ctx.supabase
    .from("saved_licitacoes")
    .select("id, titulo, orgao, uf, etapa")
    .eq("numero_controle_pncp", numero);
  if (!linhas?.length) return { paraModelo: json({ resultado: "Essa licitação não está em Minhas Licitações. Nada a remover." }) };
  const ids = linhas.map((l) => String(l.id));
  const { data: propostas } = await ctx.supabase.from("propostas").select("status").in("licitacao_id", ids);
  if ((propostas ?? []).some((p) => p.status === "enviada")) {
    return {
      paraModelo: json({
        erro: "Não posso remover: a proposta desta licitação já foi ENVIADA e o registro do envio seria perdido. " +
          "Explique ao usuário que, se quiser mesmo, ele pode remover manualmente em Minhas Licitações.",
      }),
    };
  }
  const temRascunho = (propostas ?? []).length > 0;
  const l = linhas[0];
  return {
    paraModelo: json({ resultado: "PENDENTE: pedido de aprovação exibido ao usuário num cartão. Ainda NÃO foi removida — não diga que foi." }),
    acao: {
      tipo: "remover_licitacao_salva",
      parametros: { ids, numero },
      resumo: "Remover licitação de Minhas Licitações",
      detalhes: [
        { rotulo: "Objeto", valor: String(l.titulo ?? "").slice(0, 180) },
        { rotulo: "Órgão", valor: `${l.orgao}${l.uf ? ` · ${l.uf}` : ""}` },
        { rotulo: "Etapa atual", valor: ETAPAS_LICITACAO.find((e) => e.slug === normalizarEtapa(l.etapa))?.nome ?? String(l.etapa) },
        { rotulo: "Nº PNCP", valor: numero },
      ],
      aviso: temRascunho ? "Esta licitação tem um rascunho de proposta, que também será apagado." : undefined,
    },
  };
}

async function lerDocumento(args: Args, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  const origem = texto(args.origem) === "cliente_documentos" ? "cliente_documentos" : "documentos";
  const id = texto(args.id);
  if (!id) return { paraModelo: json({ erro: "Informe o id do documento." }) };
  const { data: doc } = await ctx.supabase.from(origem).select("nome, tipo, arquivo_path, arquivo_nome").eq("id", id).maybeSingle();
  if (!doc?.arquivo_path) return { paraModelo: json({ erro: "Documento não encontrado (ou sem arquivo)." }) };
  const nome = String(doc.arquivo_nome || doc.nome || "arquivo");
  const lido = await lerAnexo(ctx.supabase, { path: String(doc.arquivo_path), nome, tamanho: 0, mime: "" });
  if (lido.imagem) {
    return { paraModelo: json({ documento: doc.nome, observacao: "É uma imagem; não consigo lê-la por aqui. Peça ao usuário para anexá-la na conversa." }) };
  }
  return { paraModelo: json({ documento: doc.nome, tipo: doc.tipo, arquivo: nome, observacao: lido.observacao ?? null, conteudo: lido.texto.slice(0, 30_000) }) };
}

async function cnaes(args: Args, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  let cnpj = texto(args.cnpj).replace(/\D/g, "");
  if (!cnpj) {
    const { data } = await ctx.supabase.from("empresa").select("cnpj").limit(1).maybeSingle();
    cnpj = String(data?.cnpj ?? "").replace(/\D/g, "");
  }
  if (cnpj.length !== 14) return { paraModelo: json({ erro: "CNPJ inválido ou não cadastrado em Dados da Empresa." }) };
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!r.ok) return { paraModelo: json({ erro: `A Receita (BrasilAPI) não respondeu (HTTP ${r.status}). Tente de novo em instantes.` }) };
  const d = (await r.json()) as {
    razao_social?: string; cnae_fiscal?: number; cnae_fiscal_descricao?: string; situacao_cadastral?: number | string;
    descricao_situacao_cadastral?: string; porte?: string; opcao_pelo_simples?: boolean | null; opcao_pelo_mei?: boolean | null;
    cnaes_secundarios?: Array<{ codigo: number; descricao: string }>;
  };
  const fmtCnae = (c: number) => String(c).padStart(7, "0").replace(/^(\d{4})(\d)(\d{2})$/, "$1-$2/$3");
  return {
    paraModelo: json({
      cnpj, razao_social: d.razao_social, situacao: d.descricao_situacao_cadastral, porte: d.porte,
      simples_nacional: d.opcao_pelo_simples ?? null, mei: d.opcao_pelo_mei ?? null,
      cnae_principal: d.cnae_fiscal ? { codigo: fmtCnae(d.cnae_fiscal), descricao: d.cnae_fiscal_descricao } : null,
      cnaes_secundarios: (d.cnaes_secundarios ?? []).filter((c) => c.codigo).map((c) => ({ codigo: fmtCnae(c.codigo), descricao: c.descricao })),
    }),
  };
}

export async function executarFerramenta(nome: string, argsTexto: string, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  let args: Args = {};
  try {
    args = argsTexto ? (JSON.parse(argsTexto) as Args) : {};
  } catch {
    return { paraModelo: json({ erro: "Argumentos inválidos (JSON malformado)." }) };
  }
  try {
    switch (nome) {
      case "buscar_licitacoes": return await buscar(args, ctx);
      case "detalhar_licitacao": return await detalhar(args, ctx);
      case "listar_licitacoes_salvas": return await listarSalvas(args, ctx);
      case "consultar_empresa": return await empresa(ctx);
      case "consultar_documentos": return await documentos(args, ctx);
      case "salvar_licitacao": return await proporSalvar(args, ctx);
      case "remover_licitacao_salva": return await proporRemover(args, ctx);
      case "consultar_dados": return { paraModelo: await consultarDados(args, ctx.supabase) };
      case "alterar_dados": return await proporAlteracao(args, ctx.supabase);
      case "ler_documento": return await lerDocumento(args, ctx);
      case "consultar_cnaes": return await cnaes(args, ctx);
      case "rascunho_nota_fiscal": return await proporNotaFiscal(args, ctx.supabase);
      case "preencher_proposta": return await proporProposta(args, ctx.supabase);
      case "perguntar": {
        const r = montarPergunta(args);
        if (!r.ok) return { paraModelo: json({ erro: r.erro }) };
        return { paraModelo: json({ resultado: "Pergunta exibida ao usuário com opções clicáveis. PARE AGORA: não escreva mais nada e aguarde a resposta dele." }), pergunta: r.pergunta };
      }
      case "memorizar": return { paraModelo: await memorizar(args, ctx, ctx.conversaId) };
      case "esquecer_memoria": return { paraModelo: await esquecer(args, ctx) };
      case "manual_do_sistema": return { paraModelo: manualDoSistema(texto(args.topico)) };
      default: return { paraModelo: json({ erro: `Ferramenta desconhecida: ${nome}` }) };
    }
  } catch (e) {
    return { paraModelo: json({ erro: e instanceof Error ? e.message : "Falha ao executar a ferramenta." }) };
  }
}
