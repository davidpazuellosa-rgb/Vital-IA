import type { SupabaseClient } from "@supabase/supabase-js";
import { margemReal, normalizarItem } from "@/lib/catalogo/types";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { ETAPAS_LICITACAO } from "@/lib/licitacoes/types";
import type { AcaoProposta, DetalheAcao } from "./ferramentas";

/* ---------------------------------------------------------------------------------------------
 * Acesso da Vita ao banco de dados.
 *  - SEMPRE com a sessão do usuário: as regras de acesso (RLS) valem igual à tela.
 *  - LEITURA: tabelas e colunas da lista abaixo (colunas com segredos ficam de fora).
 *  - ALTERAÇÃO: só nas tabelas/colunas/operações listadas, e sempre via cartão de aprovação.
 *  - Fora do alcance: notas fiscais e numeração de NF-e (fiscal), segredos (tokens/chaves),
 *    tabelas internas (vita_*, empresa_membros, lembretes…) e dados da empresa.
 * ------------------------------------------------------------------------------------------- */

type Operacao = "inserir" | "atualizar" | "remover";
type RegraTabela = {
  descricao: string;
  leitura: string[];
  /** Colunas que a Vita pode preencher/alterar (com aprovação). */
  escrita?: string[];
  operacoes?: Operacao[];
  /** Quem é o dono da linha ao inserir: a empresa (compartilhado) ou o usuário. */
  escopo: "empresa" | "usuario";
  /** Coluna-chave usada em atualizar/remover. */
  chave?: "id" | "user_id";
  pagina?: string;
};

export const TABELAS: Record<string, RegraTabela> = {
  empresa: {
    descricao: "Dados cadastrais da empresa (1 linha; usados em propostas e notas fiscais).",
    leitura: ["razao_social", "nome_fantasia", "cnpj", "porte", "natureza_juridica", "data_abertura", "cnae_principal", "inscricao_estadual", "inscricao_municipal", "email", "telefone", "cep", "logradouro", "numero", "complemento", "bairro", "municipio", "uf", "dados_bancarios", "updated_at"],
    escrita: ["razao_social", "nome_fantasia", "cnpj", "porte", "natureza_juridica", "data_abertura", "cnae_principal", "inscricao_estadual", "inscricao_municipal", "email", "telefone", "cep", "logradouro", "numero", "complemento", "bairro", "municipio", "uf", "dados_bancarios"],
    operacoes: ["atualizar"],
    escopo: "empresa", chave: "user_id", pagina: "/vital-norte/dados",
  },
  documentos: {
    descricao: "Acervo de documentos de habilitação (certidões etc.) com validade. O arquivo é lido com ler_documento.",
    leitura: ["id", "tipo", "nome", "arquivo_nome", "data_emissao", "data_validade", "validade_automatica", "created_at"],
    escrita: ["nome", "tipo", "data_emissao", "data_validade"],
    operacoes: ["atualizar"],
    escopo: "empresa", chave: "id", pagina: "/documentos",
  },
  clientes: {
    descricao: "Clientes (órgãos que contrataram a empresa).",
    leitura: ["id", "nome", "orgao", "status", "proximo_passo", "observacoes", "cnpj", "inscricao_estadual", "cep", "logradouro", "numero", "bairro", "municipio", "uf", "created_at"],
    escrita: ["nome", "orgao", "status", "proximo_passo", "observacoes", "cnpj", "inscricao_estadual", "cep", "logradouro", "numero", "bairro", "municipio", "uf"],
    operacoes: ["inserir", "atualizar"],
    escopo: "usuario", chave: "id", pagina: "/vital-norte/clientes",
  },
  contratacoes: {
    descricao: "Contratações de cada cliente (cliente_id → clientes.id).",
    leitura: ["id", "cliente_id", "titulo", "identificador", "status", "proximo_passo", "created_at"],
    escrita: ["cliente_id", "titulo", "identificador", "status", "proximo_passo"],
    operacoes: ["inserir", "atualizar"],
    escopo: "usuario", chave: "id", pagina: "/vital-norte/clientes",
  },
  cliente_documentos: {
    descricao: "Documentos guardados em clientes/contratações (edital, proposta final, empenho, contrato…).",
    leitura: ["id", "cliente_id", "contratacao_id", "tipo", "nome", "arquivo_nome", "created_at"],
    escopo: "usuario",
  },
  saved_licitacoes: {
    descricao: "Minhas Licitações (licitações salvas) e a etapa de cada uma.",
    leitura: ["id", "numero_controle_pncp", "plataforma", "titulo", "orgao", "uf", "municipio", "modalidade", "situacao", "valor_estimado", "data_publicacao", "data_abertura_proposta", "data_encerramento_proposta", "link_origem", "observacoes", "etapa", "created_at"],
    escrita: ["etapa", "observacoes"],
    operacoes: ["atualizar"],
    escopo: "usuario", chave: "id", pagina: "/minhas-licitacoes",
  },
  propostas: {
    descricao: "Propostas (rascunho, gerada ou enviada) de cada licitação salva (licitacao_id → saved_licitacoes.id). Para preencher marca/preço use preencher_proposta.",
    leitura: ["id", "licitacao_id", "status", "validade_dias", "prazo_entrega", "condicoes_pagamento", "observacoes", "itens", "edital_analisado_em", "plataforma_envio", "enviada_em", "protocolo_envio", "valor_enviado", "updated_at"],
    escopo: "usuario",
  },
  notas_fiscais: {
    descricao: "Notas fiscais (NF-e) emitidas e rascunhos. Para criar/alterar RASCUNHO use rascunho_nota_fiscal (nunca alterar_dados).",
    leitura: ["id", "cliente_id", "contratacao_id", "status", "numero", "serie", "natureza_operacao", "valor_total", "itens", "observacoes", "destinatario_nome", "destinatario_documento", "destinatario_municipio", "destinatario_uf", "chave", "motivo_rejeicao", "created_at", "updated_at"],
    escopo: "usuario",
  },
  alertas: {
    descricao: "Alertas automáticos de licitação (avisos por Telegram/e-mail de hora em hora).",
    leitura: ["id", "nome", "keyword", "ufs", "modalidades", "valor_min", "valor_max", "apenas_aberto", "ativo", "ultima_execucao", "created_at"],
    escrita: ["nome", "keyword", "ufs", "modalidades", "valor_min", "valor_max", "apenas_aberto", "ativo"],
    operacoes: ["inserir", "atualizar", "remover"],
    escopo: "usuario", chave: "id", pagina: "/vital-norte/alertas",
  },
  sistemas_licitacao: {
    descricao: "Portais de licitação em que a empresa tem cadastro (atalhos).",
    leitura: ["id", "nome", "url", "login", "observacoes", "ordem", "created_at"],
    escrita: ["nome", "url", "login", "observacoes", "ordem"],
    operacoes: ["inserir", "atualizar", "remover"],
    escopo: "empresa", chave: "id", pagina: "/vital-norte/sistemas",
  },
  catalogo_itens: {
    descricao: "Catálogo de produtos e serviços da empresa (custo, preço de referência, margem mínima %).",
    leitura: ["id", "tipo", "nome", "descricao", "categoria", "unidade", "marca", "codigo", "custo", "preco_referencia", "margem_minima", "fornecedores", "observacoes", "ativo", "updated_at"],
    escrita: ["tipo", "nome", "descricao", "categoria", "unidade", "marca", "codigo", "custo", "preco_referencia", "margem_minima", "fornecedores", "observacoes", "ativo"],
    operacoes: ["inserir", "atualizar", "remover"],
    escopo: "empresa", chave: "id", pagina: "/vital-norte/catalogo",
  },
  proposta_configuracao: {
    descricao: "Configuração padrão das propostas (validade, impostos, representante legal) — 1 linha.",
    leitura: ["validade_dias", "impostos_inclusos", "representante_legal", "representante_cargo", "observacoes_padrao", "updated_at"],
    escrita: ["validade_dias", "impostos_inclusos", "representante_legal", "representante_cargo", "observacoes_padrao"],
    operacoes: ["atualizar"],
    escopo: "empresa", chave: "user_id", pagina: "/configuracoes",
  },
  notificacoes_config: {
    descricao: "Para onde vão os avisos (chat do Telegram, e-mail de destino). Tokens e chaves NÃO são visíveis.",
    leitura: ["telegram_chat_id", "email_destino", "updated_at"],
    escopo: "usuario",
  },
};

export const NOMES_TABELAS = Object.keys(TABELAS);
export const TABELAS_ALTERAVEIS = NOMES_TABELAS.filter((t) => TABELAS[t].operacoes?.length);

/** Resumo do esquema para as instruções da Vita. */
export function descreverEsquema(): string {
  return NOMES_TABELAS.map((t) => {
    const r = TABELAS[t];
    const alt = r.operacoes?.length ? ` | pode ${r.operacoes.join("/")} (com aprovação): ${r.escrita?.join(", ")}` : " | só leitura";
    return `- ${t}: ${r.descricao} Colunas: ${r.leitura.join(", ")}${alt}`;
  }).join("\n");
}

const OPERADORES = ["eq", "neq", "gt", "gte", "lt", "lte", "contem", "vazio", "em"] as const;
type Filtro = { coluna: string; operador: (typeof OPERADORES)[number]; valor?: unknown };

const json = (v: unknown) => JSON.stringify(v);
const LIMITE_TEXTO = 1_500;
function encurtar(linha: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(linha).map(([k, v]) => {
    if (typeof v === "string" && v.length > LIMITE_TEXTO) return [k, `${v.slice(0, LIMITE_TEXTO)}… (cortado)`];
    if (v && typeof v === "object") {
      const s = JSON.stringify(v);
      return [k, s.length > 4_000 ? `${s.slice(0, 4_000)}… (cortado)` : v];
    }
    return [k, v];
  }));
}

/** consultar_dados: SELECT estruturado (sem SQL livre), com a sessão do usuário. */
export async function consultarDados(args: Record<string, unknown>, supabase: SupabaseClient): Promise<string> {
  const tabela = String(args.tabela ?? "");
  const regra = TABELAS[tabela];
  if (!regra) return json({ erro: `Tabela não disponível. Use: ${NOMES_TABELAS.join(", ")}` });
  const pedidas = Array.isArray(args.colunas) ? args.colunas.map(String).filter((c) => regra.leitura.includes(c)) : [];
  const colunas = pedidas.length ? pedidas : regra.leitura;
  let q = supabase.from(tabela).select(colunas.join(","), { count: "exact" });

  for (const f of (Array.isArray(args.filtros) ? args.filtros : []) as Filtro[]) {
    if (!regra.leitura.includes(f?.coluna)) return json({ erro: `Coluna inválida para filtro: ${f?.coluna}` });
    const v = f.valor as string | number | boolean | null;
    switch (f.operador) {
      case "eq": q = q.eq(f.coluna, v); break;
      case "neq": q = q.neq(f.coluna, v); break;
      case "gt": q = q.gt(f.coluna, v); break;
      case "gte": q = q.gte(f.coluna, v); break;
      case "lt": q = q.lt(f.coluna, v); break;
      case "lte": q = q.lte(f.coluna, v); break;
      case "contem": q = q.ilike(f.coluna, `%${String(v ?? "").replace(/[%_]/g, " ")}%`); break;
      case "vazio": q = f.valor === false ? q.not(f.coluna, "is", null) : q.is(f.coluna, null); break;
      case "em": q = q.in(f.coluna, Array.isArray(f.valor) ? f.valor : [f.valor]); break;
      default: return json({ erro: `Operador inválido: ${String(f?.operador)}. Use: ${OPERADORES.join(", ")}` });
    }
  }
  const ordenar = String(args.ordenar_por ?? "");
  if (ordenar && regra.leitura.includes(ordenar)) q = q.order(ordenar, { ascending: args.decrescente !== true, nullsFirst: false });
  const limite = Math.min(100, Math.max(1, Number(args.limite) || 30));
  const { data, error, count } = await q.limit(limite);
  if (error) return json({ erro: error.message });
  let linhas = (data ?? []).map((l) => encurtar(l as unknown as Record<string, unknown>));
  if (tabela === "saved_licitacoes") {
    linhas = linhas.map((l) => (l.id ? { ...l, link_sistema: `/licitacao/${String(l.id)}` } : l));
  }
  if (tabela === "catalogo_itens") {
    // Mesma conta da tela do Catálogo: margem sobre o custo.
    linhas = linhas.map((l) => {
      const m = margemReal(l.custo as number | null, l.preco_referencia as number | null);
      return { ...l, margem_real_sobre_custo: m == null ? null : Math.round(m * 10) / 10 };
    });
  }
  return json({ tabela, total: count ?? data?.length ?? 0, mostrando: linhas.length, linhas });
}

/* ------------------------------- alterações (com aprovação) ------------------------------- */

const MAX_LOTE = 50;
const txtOuNulo = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());
const fmt = (v: unknown) => (v == null || v === "" ? "—" : Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v));

function limparDados(tabela: string, bruto: unknown): Record<string, unknown> {
  const regra = TABELAS[tabela];
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) throw new Error("`dados` deve ser um objeto coluna → valor.");
  const invalidas = Object.keys(bruto).filter((c) => !regra.escrita?.includes(c));
  if (invalidas.length) throw new Error(`Colunas não permitidas em ${tabela}: ${invalidas.join(", ")}. Permitidas: ${regra.escrita?.join(", ")}.`);
  let dados = { ...(bruto as Record<string, unknown>) };
  if (tabela === "catalogo_itens") {
    // Numa alteração parcial o nome pode não vir; só exige nome quando ele é enviado (ou no cadastro).
    const n = normalizarItem("nome" in dados ? dados : { ...dados, nome: "-" });
    dados = Object.fromEntries(Object.keys(dados).map((k) => [k, n[k as keyof typeof n]]));
  }
  if (tabela === "empresa") {
    for (const [k, v] of Object.entries(dados)) dados[k] = k === "data_abertura" ? (txtOuNulo(v)) : String(v ?? "").trim();
    if (typeof dados.uf === "string") dados.uf = dados.uf.toUpperCase().slice(0, 2);
  }
  if (tabela === "saved_licitacoes" && "etapa" in dados && !ETAPAS_LICITACAO.some((e) => e.slug === dados.etapa)) {
    throw new Error(`Etapa inválida. Use: ${ETAPAS_LICITACAO.map((e) => e.slug).join(", ")}.`);
  }
  return dados;
}

/** alterar_dados: valida e monta o cartão de aprovação (não altera nada). */
export async function proporAlteracao(args: Record<string, unknown>, supabase: SupabaseClient): Promise<{ paraModelo: string; acao?: AcaoProposta }> {
  const tabela = String(args.tabela ?? "");
  const operacao = String(args.operacao ?? "") as Operacao;
  const regra = TABELAS[tabela];
  if (!regra?.operacoes?.length) return { paraModelo: json({ erro: `A Vita não altera "${tabela}". Tabelas alteráveis: ${TABELAS_ALTERAVEIS.join(", ")}.` }) };
  if (!regra.operacoes.includes(operacao)) return { paraModelo: json({ erro: `Em ${tabela} só é possível: ${regra.operacoes.join(", ")}.` }) };
  const motivo = String(args.motivo ?? "").trim();

  try {
    const detalhes: DetalheAcao[] = [];
    let avisoExtra: string | undefined;
    let parametros: Record<string, unknown>;
    let resumo: string;

    if (operacao === "inserir") {
      const lista = Array.isArray(args.dados) ? args.dados : [args.dados];
      if (lista.length > MAX_LOTE) throw new Error(`No máximo ${MAX_LOTE} linhas por pedido.`);
      const linhas = lista.map((d) => limparDados(tabela, d));
      parametros = { tabela, operacao, linhas };
      resumo = linhas.length > 1 ? `Cadastrar ${linhas.length} registros em ${tabela}` : `Cadastrar em ${tabela}`;
      if (linhas.length === 1) {
        for (const [k, v] of Object.entries(linhas[0])) detalhes.push({ rotulo: k, valor: fmt(v) });
      } else {
        linhas.slice(0, 15).forEach((l, i) => {
          const principal = l.nome ?? l.titulo ?? Object.values(l)[0];
          const resto = Object.entries(l)
            .filter(([k, v]) => k !== "nome" && k !== "titulo" && v != null && v !== "" && v !== true)
            .map(([k, v]) => `${k}: ${fmt(v)}`);
          detalhes.push({ rotulo: `#${i + 1}`, valor: [fmt(principal), ...resto].join(" · ").slice(0, 300) });
        });
        if (linhas.length > 15) detalhes.push({ rotulo: "…", valor: `e mais ${linhas.length - 15}` });
      }
    } else {
      const chave = regra.chave ?? "id";
      const id = chave === "user_id" ? null : String(args.id ?? "");
      if (chave === "id" && !id) throw new Error("Informe o `id` da linha (consulte antes com consultar_dados).");
      let atualQ = supabase.from(tabela).select(regra.leitura.join(","));
      if (id) atualQ = atualQ.eq("id", id);
      const { data: atual } = await atualQ.limit(1).maybeSingle();
      if (!atual) throw new Error("Linha não encontrada (ou sem permissão).");
      const linhaAtual = atual as unknown as Record<string, unknown>;

      if (operacao === "atualizar") {
        const dados = limparDados(tabela, args.dados);
        const mudancas = Object.entries(dados).filter(([k, v]) => fmt(linhaAtual[k]) !== fmt(v));
        if (!mudancas.length) return { paraModelo: json({ resultado: "Nada muda: os valores já são esses." }) };
        for (const [k, v] of mudancas) detalhes.push({ rotulo: k, valor: `${fmt(linhaAtual[k])} → ${fmt(v)}` });
        parametros = { tabela, operacao, id, dados: Object.fromEntries(mudancas) };
        resumo = tabela === "empresa" ? "Alterar Dados da Empresa" : `Alterar ${tabela}${linhaAtual.nome ? `: ${String(linhaAtual.nome).slice(0, 60)}` : ""}`;
        if (tabela === "empresa" && mudancas.some(([k]) => k === "cnpj" || k === "razao_social")) {
          avisoExtra = "Atenção: CNPJ e razão social saem nas propostas e nas notas fiscais. Confira com o cartão CNPJ antes de aprovar.";
        }
      } else {
        for (const k of ["nome", "titulo", "keyword", "url", "categoria"].filter((c) => linhaAtual[c] != null)) detalhes.push({ rotulo: k, valor: fmt(linhaAtual[k]) });
        parametros = { tabela, operacao, id };
        resumo = `Remover de ${tabela}${linhaAtual.nome ? `: ${String(linhaAtual.nome).slice(0, 60)}` : ""}`;
      }
    }
    if (motivo) detalhes.push({ rotulo: "Motivo", valor: motivo });
    return {
      paraModelo: json({ resultado: "PENDENTE: cartão de aprovação exibido ao usuário. Ainda NÃO foi feito — não diga que foi." }),
      acao: { tipo: "alterar_dados", parametros, resumo, detalhes, aviso: operacao === "remover" ? "A remoção não pode ser desfeita." : avisoExtra },
    };
  } catch (e) {
    return { paraModelo: json({ erro: e instanceof Error ? e.message : "Pedido inválido." }) };
  }
}

/** Executa uma alteração JÁ APROVADA. Revalida tudo (o pedido pode ter sido montado antes). */
export async function executarAlteracao(
  supabase: SupabaseClient, userId: string, p: Record<string, unknown>,
): Promise<{ texto: string; pagina?: string }> {
  const tabela = String(p.tabela ?? "");
  const operacao = String(p.operacao ?? "") as Operacao;
  const regra = TABELAS[tabela];
  if (!regra?.operacoes?.includes(operacao)) throw new Error("Operação não permitida.");

  if (operacao === "inserir") {
    const dono = regra.escopo === "empresa" ? await resolverEmpresaUserId(supabase, userId) : userId;
    const linhas = (p.linhas as unknown[]).map((l) => ({ ...limparDados(tabela, l), user_id: dono }));
    // defaultToNull: false → coluna ausente numa das linhas usa o valor padrão do banco (e não NULL).
    const { error, count } = await supabase.from(tabela).insert(linhas, { count: "exact", defaultToNull: false });
    if (error) throw new Error(error.message);
    return { texto: `${count ?? linhas.length} registro(s) cadastrado(s) em ${tabela}.`, pagina: regra.pagina };
  }
  if (operacao === "atualizar") {
    const dados = limparDados(tabela, p.dados);
    if (tabela === "documentos" && "data_validade" in dados) dados.validade_automatica = false;
    if (tabela === "catalogo_itens" || tabela === "proposta_configuracao" || tabela === "empresa") dados.updated_at = new Date().toISOString();
    let q = supabase.from(tabela).update(dados, { count: "exact" });
    q = regra.chave === "user_id" ? q.eq("user_id", await resolverEmpresaUserId(supabase, userId)) : q.eq("id", String(p.id));
    const { error, count } = await q;
    if (error) throw new Error(error.message);
    if (!count) throw new Error("Nenhuma linha foi alterada (ela pode ter sido removida).");
    return { texto: `${tabela} atualizado.`, pagina: regra.pagina };
  }
  const { error, count } = await supabase.from(tabela).delete({ count: "exact" }).eq("id", String(p.id));
  if (error) throw new Error(error.message);
  if (!count) throw new Error("Nada foi removido (a linha já não existia).");
  return { texto: `Registro removido de ${tabela}.`, pagina: regra.pagina };
}
