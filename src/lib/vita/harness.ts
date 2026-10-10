import type { SupabaseClient } from "@supabase/supabase-js";
import { nomeTipo } from "@/lib/documentos/types";
import { lerAnexo } from "./anexos";
import { AREAS_MAPA, MAPA, PAGINAS_MAPA, procurarNoMapa, type EntradaMapa, type FonteMapa } from "./mapa";
import { carregarMapa } from "./mapa-servidor";

/* ---------------------------------------------------------------------------------------------
 * HARNESS DE BUSCA da Vita.
 *  1. onde_encontrar     → consulta o MAPA (mapa.ts): o que existe e onde procurar.
 *  2. buscar_informacao  → para dados da empresa (CNPJ, razão social, IE, endereço, CNAEs, sócios…):
 *                          lê os DOCUMENTOS certos, extrai os valores, compara com o cadastro e
 *                          devolve o que confere, o que diverge e de qual arquivo veio cada valor.
 *  3. pesquisar_documentos → busca por termos no CONTEÚDO dos documentos (acervo e clientes).
 * Os arquivos são lidos uma vez (lerAnexo, com OCR quando escaneado) e o texto fica guardado em
 * documentos_texto; refaz sozinho se o arquivo for trocado.
 * ------------------------------------------------------------------------------------------- */

type Ctx = { supabase: SupabaseClient; userId: string };
const json = (v: unknown) => JSON.stringify(v);

/* ----------------------------------------- utilidades ----------------------------------------- */

/** Maiúsculas sem acento, MESMO comprimento do original (para achar rótulos e recortar o original). */
const alinhado = (s: string) =>
  Array.from(s.normalize("NFC")).map((c) => (c.normalize("NFD").replace(/[̀-ͯ]/g, "")[0] ?? c).toUpperCase()).join("");
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const compacto = (s: string) => s.replace(/\s+/g, " ").trim();

/** CPFs nunca saem inteiros nas respostas da Vita. */
const mascararCpf = (s: string) => s.replace(/\b(\d{3})\.(\d{3})\.(\d{3})-(\d{2})\b/g, "•••.•••.•••-$4");

const soDigitos = (s: string) => s.replace(/\D/g, "");

function cnpjValido(c: string): boolean {
  const d = soDigitos(c);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((a, n, i) => a + Number(n) * pesos[i], 0) % 11;
    return soma < 2 ? 0 : 11 - soma;
  };
  const d1 = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(d.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(d[12]) && d2 === Number(d[13]);
}

const formatarCnpj = (d: string) => d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

/* ------------------------------------- índice de texto dos arquivos ------------------------------------- */

type Origem = "documentos" | "cliente_documentos";
type DocFonte = { origem: Origem; id: string; nome: string; tipo: string; arquivo_path: string; arquivo_nome: string; dono: string; validade?: string | null };
type TextoDoc = DocFonte & { texto: string; observacao: string | null };

const ORCAMENTO_MS = 40_000;
const PARALELO = 3;

async function carregarTextos(
  supabase: SupabaseClient, docs: DocFonte[], maxNovos: number, orcamentoMs = ORCAMENTO_MS,
): Promise<{ textos: TextoDoc[]; naoLidos: Array<{ documento: string; motivo: string }>; lidosAgora: number }> {
  if (!docs.length) return { textos: [], naoLidos: [], lidosAgora: 0 };
  const { data: cache } = await supabase
    .from("documentos_texto")
    .select("origem, documento_id, arquivo_path, texto, observacao")
    .in("documento_id", docs.map((d) => d.id));
  const porId = new Map((cache ?? []).map((c) => [`${c.origem}:${c.documento_id}`, c]));

  const textos: TextoDoc[] = [];
  const faltam: DocFonte[] = [];
  for (const d of docs) {
    const c = porId.get(`${d.origem}:${d.id}`);
    if (c && c.arquivo_path === d.arquivo_path) textos.push({ ...d, texto: String(c.texto ?? ""), observacao: (c.observacao as string) ?? null });
    else faltam.push(d);
  }

  const naoLidos: Array<{ documento: string; motivo: string }> = [];
  const aLer = faltam.slice(0, maxNovos);
  for (const d of faltam.slice(maxNovos)) naoLidos.push({ documento: d.nome, motivo: "ainda não lido (limite por busca); pergunte de novo para continuar" });
  const limite = Date.now() + orcamentoMs;
  let lidosAgora = 0;
  let proximo = 0;

  async function operario() {
    while (proximo < aLer.length) {
      const d = aLer[proximo++];
      if (Date.now() > limite) { naoLidos.push({ documento: d.nome, motivo: "tempo esgotado; pergunte de novo para continuar" }); continue; }
      const lido = await lerAnexo(supabase, { path: d.arquivo_path, nome: d.arquivo_nome || d.nome, tamanho: 0, mime: "" });
      const falhou = !lido.texto && !lido.imagem && /não consegui|baixar/i.test(lido.observacao ?? "");
      if (falhou) { naoLidos.push({ documento: d.nome, motivo: lido.observacao ?? "falha na leitura" }); continue; }
      const observacao = lido.imagem ? "imagem: não indexável por texto (use ler_documento ou anexe na conversa)" : (lido.observacao ?? null);
      await supabase.from("documentos_texto").upsert({
        origem: d.origem, documento_id: d.id, user_id: d.dono, arquivo_path: d.arquivo_path,
        texto: lido.texto, caracteres: lido.texto.length, observacao, extraido_em: new Date().toISOString(),
      }, { onConflict: "origem,documento_id" });
      textos.push({ ...d, texto: lido.texto, observacao });
      lidosAgora++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALELO, aLer.length) }, operario));
  for (const t of textos) if (!t.texto.trim() && t.observacao) naoLidos.push({ documento: t.nome, motivo: t.observacao });
  return { textos: textos.filter((t) => t.texto.trim()), naoLidos, lidosAgora };
}

async function docsAcervo(supabase: SupabaseClient, tipos?: string[]): Promise<DocFonte[]> {
  let q = supabase.from("documentos").select("id, tipo, nome, arquivo_path, arquivo_nome, data_validade, user_id").order("created_at", { ascending: false });
  if (tipos?.length) q = q.in("tipo", tipos);
  const { data } = await q.limit(120);
  return (data ?? []).filter((d) => d.arquivo_path).map((d) => ({
    origem: "documentos" as const, id: String(d.id), nome: String(d.nome), tipo: String(d.tipo), arquivo_path: String(d.arquivo_path),
    arquivo_nome: String(d.arquivo_nome ?? d.nome), dono: String(d.user_id), validade: d.data_validade as string | null,
  }));
}

async function docsClientes(supabase: SupabaseClient): Promise<DocFonte[]> {
  const { data } = await supabase.from("cliente_documentos").select("id, tipo, nome, arquivo_path, arquivo_nome, user_id").order("created_at", { ascending: false }).limit(80);
  return (data ?? []).filter((d) => d.arquivo_path).map((d) => ({
    origem: "cliente_documentos" as const, id: String(d.id), nome: String(d.nome), tipo: String(d.tipo), arquivo_path: String(d.arquivo_path),
    arquivo_nome: String(d.arquivo_nome ?? d.nome), dono: String(d.user_id),
  }));
}

/* ----------------------------------------- extratores ----------------------------------------- */

type Achado = { valor: string; trecho?: string };
type Empresa = Record<string, unknown> | null;

/** Rótulos do Cartão CNPJ (Receita), usados como "paradas" para recortar cada valor. */
const ROTULOS_CARTAO = [
  "NUMERO DE INSCRICAO", "DATA DE ABERTURA", "NOME EMPRESARIAL", "TITULO DO ESTABELECIMENTO", "PORTE",
  "CODIGO E DESCRICAO DA ATIVIDADE ECONOMICA PRINCIPAL", "CODIGO E DESCRICAO DAS ATIVIDADES ECONOMICAS SECUNDARIAS",
  "CODIGO E DESCRICAO DA NATUREZA JURIDICA", "LOGRADOURO", "ENDERECO ELETRONICO", "TELEFONE",
  "ENTE FEDERATIVO RESPONSAVEL", "SITUACAO CADASTRAL", "DATA DA SITUACAO CADASTRAL", "MOTIVO DE SITUACAO CADASTRAL",
  "SITUACAO ESPECIAL", "DATA DA SITUACAO ESPECIAL", "COMPROVANTE DE SITUACAO", "ASSINATURA",
];

function porRotulo(texto: string, rotulos: string[], max = 220): string | null {
  const n = alinhado(texto);
  for (const r of rotulos) {
    const i = n.indexOf(r);
    if (i < 0) continue;
    const ini = i + r.length;
    let fim = ini + max;
    for (const outro of ROTULOS_CARTAO) {
      if (outro === r || r.startsWith(outro) || outro.startsWith(r)) continue;
      const j = n.indexOf(outro, ini);
      if (j >= 0 && j < fim) fim = j;
    }
    const v = compacto(texto.slice(ini, fim)).replace(/^[:\-–\s]+/, "").trim();
    if (v) return v;
  }
  return null;
}

function janela(texto: string, i: number, antes = 70, depois = 130): string {
  return mascararCpf(compacto(texto.slice(Math.max(0, i - antes), Math.min(texto.length, i + depois))));
}

function achados(regex: RegExp, texto: string, tratar: (m: RegExpExecArray) => string | null, max = 4): Achado[] {
  const out: Achado[] = [];
  for (const m of texto.matchAll(new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g"))) {
    const v = tratar(m as RegExpExecArray);
    if (v) out.push({ valor: v, trecho: janela(texto, m.index ?? 0) });
    if (out.length >= max) break;
  }
  return out;
}

function trechosPorPalavra(texto: string, regex: RegExp, max = 3): Achado[] {
  const out: Achado[] = [];
  let ultimo = -1000;
  for (const m of texto.matchAll(new RegExp(regex.source, "gi"))) {
    const i = m.index ?? 0;
    if (i - ultimo < 250) continue;
    ultimo = i;
    out.push({ valor: janela(texto, i, 40, 240) });
    if (out.length >= max) break;
  }
  return out;
}

const ehCartao = (tipo: string, texto: string) => tipo === "cnpj" || /COMPROVANTE DE INSCRICAO E DE SITUACAO CADASTRAL/.test(alinhado(texto.slice(0, 1500)));
const dedupe = (a: Achado[]) => a.filter((x, i) => a.findIndex((y) => semAcento(y.valor) === semAcento(x.valor)) === i);

type Campo = {
  id: string;
  rotulo: string;
  palavras: string[];
  /** Tipos de documento onde procurar, do mais confiável ao menos. */
  tipos: string[];
  /** Valor no cadastro (Dados da Empresa), se houver. */
  cadastro?: (e: NonNullable<Empresa>) => string | null;
  extrair: (texto: string, tipo: string) => Achado[];
  /** Compara normalizado (padrão: texto sem acento/pontuação). */
  chave?: (v: string) => string;
};

const chaveTexto = (v: string) => semAcento(v).replace(/[^a-z0-9]+/g, " ").trim();
const str = (v: unknown) => { const s = String(v ?? "").trim(); return s || null; };

const CAMPOS: Campo[] = [
  {
    id: "cnpj", rotulo: "CNPJ", palavras: ["cnpj"], tipos: ["cnpj", "contrato_social", "inscricao_estadual", "inscricao_municipal", "cnd_federal", "fgts", "trabalhista", "estadual", "municipal", "falencia"],
    cadastro: (e) => str(e.cnpj),
    chave: soDigitos,
    extrair: (t) => achados(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, t, (m) => (cnpjValido(m[0]) ? formatarCnpj(soDigitos(m[0])) : null), 3),
  },
  {
    id: "razao_social", rotulo: "Razão social", palavras: ["razao social", "nome empresarial", "razao"], tipos: ["cnpj", "contrato_social"],
    cadastro: (e) => str(e.razao_social),
    extrair: (t, tipo) => {
      if (ehCartao(tipo, t)) { const v = porRotulo(t, ["NOME EMPRESARIAL"], 120); return v ? [{ valor: v }] : []; }
      const topo = t.slice(0, 900);
      return achados(/([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 .&\-]{3,80}?\s(?:LTDA|EIRELI|S\.?\/?A\.?|ME|EPP|MEI))\b/, topo, (m) => compacto(m[1]), 1);
    },
  },
  {
    id: "nome_fantasia", rotulo: "Nome fantasia", palavras: ["nome fantasia", "fantasia"], tipos: ["cnpj"],
    cadastro: (e) => str(e.nome_fantasia),
    extrair: (t) => { const v = porRotulo(t, ["TITULO DO ESTABELECIMENTO"], 120)?.replace(/^\(?NOME DE FANTASIA\)?\s*/i, ""); return v && !/^\*+$/.test(v) ? [{ valor: v }] : []; },
  },
  {
    id: "porte", rotulo: "Porte", palavras: ["porte", "me epp", "microempresa"], tipos: ["cnpj"],
    cadastro: (e) => str(e.porte),
    extrair: (t) => { const v = porRotulo(t, ["PORTE"], 40); return v ? [{ valor: v }] : []; },
  },
  {
    id: "natureza_juridica", rotulo: "Natureza jurídica", palavras: ["natureza juridica", "natureza"], tipos: ["cnpj", "contrato_social"],
    cadastro: (e) => str(e.natureza_juridica),
    extrair: (t) => { const v = porRotulo(t, ["CODIGO E DESCRICAO DA NATUREZA JURIDICA"], 100); return v ? [{ valor: v }] : []; },
  },
  {
    id: "data_abertura", rotulo: "Data de abertura", palavras: ["data de abertura", "abertura", "fundacao", "inicio das atividades"], tipos: ["cnpj"],
    cadastro: (e) => str(e.data_abertura),
    chave: (v) => { const m = v.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : v; },
    extrair: (t) => { const v = porRotulo(t, ["DATA DE ABERTURA"], 30)?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0]; return v ? [{ valor: v }] : []; },
  },
  {
    id: "cnae_principal", rotulo: "CNAE principal", palavras: ["cnae principal", "atividade principal", "cnae"], tipos: ["cnpj"],
    cadastro: (e) => str(e.cnae_principal),
    chave: (v) => soDigitos(v).slice(0, 7),
    extrair: (t) => { const v = porRotulo(t, ["CODIGO E DESCRICAO DA ATIVIDADE ECONOMICA PRINCIPAL"], 160); return v ? [{ valor: v }] : []; },
  },
  {
    id: "cnaes_secundarios", rotulo: "CNAEs secundários", palavras: ["cnaes secundarios", "atividades secundarias", "secundari", "cnaes", "ramos de atuacao"], tipos: ["cnpj"],
    extrair: (t) => { const v = porRotulo(t, ["CODIGO E DESCRICAO DAS ATIVIDADES ECONOMICAS SECUNDARIAS"], 1800); return v ? [{ valor: v }] : []; },
  },
  {
    id: "endereco", rotulo: "Endereço", palavras: ["endereco", "sede", "cep", "onde fica", "logradouro"], tipos: ["cnpj"],
    cadastro: (e) => [e.logradouro, e.numero, e.complemento, e.bairro, e.cep, e.municipio, e.uf].map(str).filter(Boolean).join(", ") || null,
    chave: () => "",
    extrair: (t) => { const v = porRotulo(t, ["LOGRADOURO"], 320); return v ? [{ valor: v }] : []; },
  },
  {
    id: "telefone", rotulo: "Telefone", palavras: ["telefone", "fone", "celular"], tipos: ["cnpj"],
    cadastro: (e) => str(e.telefone),
    chave: soDigitos,
    extrair: (t) => { const v = porRotulo(t, ["TELEFONE"], 60); return v ? [{ valor: v }] : []; },
  },
  {
    id: "email", rotulo: "E-mail", palavras: ["email", "e-mail", "endereco eletronico"], tipos: ["cnpj"],
    cadastro: (e) => str(e.email),
    chave: (v) => v.toLowerCase().trim(),
    extrair: (t) => achados(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/, t, (m) => m[0].toLowerCase(), 2),
  },
  {
    id: "situacao_cadastral", rotulo: "Situação cadastral", palavras: ["situacao cadastral", "situacao", "ativa", "baixada", "regular"], tipos: ["cnpj"],
    extrair: (t) => { const v = porRotulo(t, ["SITUACAO CADASTRAL"], 60); return v ? [{ valor: v }] : []; },
  },
  {
    id: "inscricao_estadual", rotulo: "Inscrição estadual", palavras: ["inscricao estadual", "ie", "icms"], tipos: ["inscricao_estadual", "cnpj", "estadual"],
    cadastro: (e) => str(e.inscricao_estadual),
    chave: soDigitos,
    extrair: (t) => achados(/INSCRI[CÇ][AÃ]O\s+ESTADUAL[^0-9]{0,45}([0-9][0-9.\-\/]{5,22})/i, t, (m) => m[1].replace(/[.\-\/]+$/, ""), 2),
  },
  {
    id: "inscricao_municipal", rotulo: "Inscrição municipal", palavras: ["inscricao municipal", "im", "iss"], tipos: ["inscricao_municipal", "municipal"],
    cadastro: (e) => str(e.inscricao_municipal),
    chave: soDigitos,
    extrair: (t) => achados(/INSCRI[CÇ][AÃ]O\s+MUNICIPAL[^0-9]{0,45}([0-9][0-9.\-\/]{3,22})/i, t, (m) => m[1].replace(/[.\-\/]+$/, ""), 2),
  },
  {
    id: "capital_social", rotulo: "Capital social", palavras: ["capital social", "capital"], tipos: ["contrato_social"],
    chave: (v) => soDigitos(v),
    extrair: (t) => achados(/CAPITAL\s+SOCIAL[^R\d]{0,90}R\$\s*([\d.]+(?:,\d{2})?)/i, t, (m) => `R$ ${m[1]}`, 2),
  },
  {
    id: "socios", rotulo: "Sócios e administração", palavras: ["socio", "socios", "administrador", "representante legal", "quadro societario", "proprietario"], tipos: ["contrato_social", "socio_identidade_pazu", "socio_identidade_ruy"],
    chave: () => "",
    extrair: (t) => trechosPorPalavra(t, /\bS[ÓO]CIO(?:S)?\b|\bADMINISTRA(?:DOR|ÇÃO)\b/, 3),
  },
  {
    id: "dados_bancarios", rotulo: "Dados bancários", palavras: ["banco", "agencia", "conta", "titularidade", "dados bancarios"], tipos: ["conta_titularidade_1", "conta_titularidade_2"],
    cadastro: (e) => str(e.dados_bancarios),
    chave: () => "",
    extrair: (t) => trechosPorPalavra(t, /\bAG[ÊE]NCIA\b|\bCONTA\b|\bBANCO\b/, 2),
  },
];

const GRUPO_CADASTRAIS = ["cnpj", "razao_social", "nome_fantasia", "porte", "natureza_juridica", "data_abertura", "cnae_principal", "cnaes_secundarios", "endereco", "telefone", "email", "situacao_cadastral"];
const PALAVRAS_GRUPO = ["dados cadastrais", "dados da empresa", "cartao cnpj", "perfil da empresa", "informacoes da empresa", "tudo da empresa", "dados completos"];

function resolverCampos(assunto: string): Campo[] {
  const q = semAcento(assunto);
  if (PALAVRAS_GRUPO.some((p) => q.includes(p))) return GRUPO_CADASTRAIS.map((id) => CAMPOS.find((c) => c.id === id)!);
  const pontuados = CAMPOS.map((c) => ({ c, p: c.palavras.reduce((s, w) => s + (q.includes(w) ? (w.length > 4 ? 2 : 1) : 0), 0) + (q.includes(c.id.replace(/_/g, " ")) ? 3 : 0) }))
    .filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
  if (!pontuados.length) return [];
  // "cnaes" pede principal + secundários juntos
  const ids = new Set(pontuados.slice(0, 3).map((x) => x.c.id));
  if (ids.has("cnaes_secundarios")) ids.add("cnae_principal");
  return CAMPOS.filter((c) => ids.has(c.id));
}

/* ------------------------------------------- 1) mapa ------------------------------------------- */

const descreverFonte = (f: FonteMapa): string =>
  f.tipo === "documento" ? `documentos do tipo ${f.tipos.map((t) => `${t} (${nomeTipo(t)})`).join(", ") || "de clientes"}${f.nota ? ` — ${f.nota}` : ""}` :
  f.tipo === "tabela" ? `tabela ${f.tabela}${f.colunas ? ` [${f.colunas}]` : ""}${f.nota ? ` — ${f.nota}` : ""}` :
  f.tipo === "ferramenta" ? `ferramenta ${f.nome}${f.nota ? ` — ${f.nota}` : ""}` :
  f.tipo === "pagina" ? `página ${f.rota}${f.nota ? ` — ${f.nota}` : ""}` : `${f.nome}${f.nota ? ` — ${f.nota}` : ""}`;

export function ondeEncontrar(args: Record<string, unknown>, mapa: EntradaMapa[] = MAPA): string {
  const assunto = String(args.assunto ?? "").trim();
  if (!assunto) return json({ erro: "Informe o assunto (ex.: \"CNPJ\", \"validade das certidões\", \"itens de uma licitação\")." });
  const achadas = procurarNoMapa(assunto, 3, mapa);
  const paginas = PAGINAS_MAPA.filter((p) => semAcento(`${p.nome} ${p.tem}`).split(/[^a-z0-9]+/).some((w) => w.length > 3 && semAcento(assunto).includes(w))).slice(0, 3);
  if (!achadas.length) {
    return json({
      resultado: "Não achei esse assunto no mapa. Tente pesquisar_documentos (conteúdo dos arquivos) ou consultar_dados (tabelas).",
      assuntos_do_mapa: AREAS_MAPA.map((a) => ({ area: a, assuntos: mapa.filter((e) => e.area === a).map((e) => e.assunto) })).filter((a) => a.assuntos.length),
    });
  }
  return json({
    resultados: achadas.map((e) => ({ assunto: e.assunto, area: e.area, ...(e.origem === "personalizado" ? { criado_pela_empresa: true } : {}), onde_procurar_em_ordem: e.fontes.map(descreverFonte), ...(e.dica ? { dica: e.dica } : {}) })),
    ...(paginas.length ? { paginas_relacionadas: paginas.map((p) => `${p.nome} (${p.rota}): ${p.tem}`) } : {}),
  });
}

/* ------------------------------------ 2) buscar_informacao ------------------------------------ */

export async function buscarInformacao(args: Record<string, unknown>, ctx: Ctx): Promise<string> {
  const assunto = String(args.assunto ?? "").trim();
  if (!assunto) return json({ erro: "Informe o assunto (ex.: \"CNPJ\", \"razão social\", \"dados cadastrais\", \"inscrição estadual\", \"sócios\")." });
  const campos = resolverCampos(assunto);
  if (!campos.length) {
    return json({ aviso: `Não tenho um extrator para "${assunto}". Siga o mapa:`, mapa: JSON.parse(ondeEncontrar({ assunto }, await carregarMapa(ctx.supabase))) });
  }

  const { data: empresa } = await ctx.supabase.from("empresa").select("*").limit(1).maybeSingle();
  const tipos = [...new Set(campos.flatMap((c) => c.tipos))];
  const prioridade = new Map(tipos.map((t, i) => [t, i]));
  const docs = (await docsAcervo(ctx.supabase, tipos)).sort((a, b) => (prioridade.get(a.tipo) ?? 99) - (prioridade.get(b.tipo) ?? 99));
  const { textos, naoLidos, lidosAgora } = await carregarTextos(ctx.supabase, docs, 8);
  const tiposPresentes = new Set(docs.map((d) => d.tipo));

  const resultado = campos.map((c) => {
    const cadastro = empresa && c.cadastro ? c.cadastro(empresa as NonNullable<Empresa>) : null;
    const porValor = new Map<string, { valor: string; fontes: Array<{ documento: string; tipo: string; arquivo: string; trecho?: string }> }>();
    for (const t of textos.filter((x) => c.tipos.includes(x.tipo) || (c.id !== "cnpj" && ehCartao(x.tipo, x.texto) && c.tipos.includes("cnpj")))) {
      for (const a of dedupe(c.extrair(t.texto, t.tipo))) {
        const k = (c.chave ?? chaveTexto)(a.valor) || chaveTexto(a.valor);
        const item = porValor.get(k) ?? { valor: mascararCpf(a.valor), fontes: [] };
        if (item.fontes.length < 3) item.fontes.push({ documento: `${nomeTipo(t.tipo)} — ${t.nome}`, tipo: t.tipo, arquivo: t.arquivo_nome, ...(a.trecho ? { trecho: a.trecho } : {}) });
        porValor.set(k, item);
      }
    }
    const valores = [...porValor.entries()].slice(0, 4);
    const kCad = cadastro ? (c.chave ?? chaveTexto)(cadastro) : "";
    let situacao: string;
    if (!valores.length) situacao = cadastro ? "so_no_cadastro" : "nao_encontrado";
    else if (!cadastro) situacao = "so_nos_documentos";
    else if (!kCad) situacao = "comparar_manualmente";
    else situacao = valores.some(([k]) => k === kCad || k.includes(kCad) || kCad.includes(k)) ? (valores.length > 1 ? "confirmado_mas_ha_outros_valores" : "confirmado") : "DIVERGENTE";
    const faltaDoc = c.tipos.slice(0, 2).filter((t) => !tiposPresentes.has(t));
    return {
      campo: c.rotulo,
      situacao,
      cadastro_dados_da_empresa: cadastro,
      nos_documentos: valores.map(([, v]) => v),
      ...(!valores.length && faltaDoc.length ? { observacao: `Não há no acervo: ${faltaDoc.map((t) => `${nomeTipo(t)} (${t})`).join(", ")}.` } : {}),
    };
  });

  const divergentes = resultado.filter((r) => r.situacao === "DIVERGENTE").map((r) => r.campo);
  return json({
    assunto,
    resultados: resultado,
    documentos_lidos: textos.length,
    lidos_agora: lidosAgora,
    ...(naoLidos.length ? { nao_lidos: naoLidos.slice(0, 8) } : {}),
    ...(divergentes.length ? { atencao: `Divergência entre o cadastro (Dados da Empresa) e os documentos em: ${divergentes.join(", ")}. Prefira o documento oficial, avise o usuário e ofereça corrigir o cadastro (alterar_dados, tabela empresa).` } : {}),
    como_responder: "Cite de qual documento veio cada valor. Se houver divergência, diga qual é qual. Não invente o que não foi encontrado.",
  });
}

/* ----------------------------------- 3) pesquisar_documentos ----------------------------------- */

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em", "no", "na", "para", "por", "com", "que", "um", "uma", "se", "os", "as"]);

function termosDe(v: unknown): string[] {
  const lista = Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[,;\n]+/);
  const partes = lista.flatMap((t) => (t.trim().includes(" ") && lista.length === 1 ? t.split(/\s+/) : [t]));
  return [...new Set(partes.map((t) => semAcento(t).trim()).filter((t) => t.length > 2 && !PALAVRAS_VAZIAS.has(t)))].slice(0, 8);
}

export async function pesquisarDocumentos(args: Record<string, unknown>, ctx: Ctx): Promise<string> {
  const termos = termosDe(args.termos ?? args.consulta);
  if (!termos.length) return json({ erro: "Informe os termos a procurar (ex.: [\"capital social\"], [\"validade da proposta\"])." });
  const escopo = ["clientes", "tudo"].includes(String(args.escopo)) ? String(args.escopo) : "acervo";
  const tipos = Array.isArray(args.tipos) ? args.tipos.map(String).slice(0, 12) : undefined;
  const limite = Math.min(10, Math.max(1, Number(args.limite) || 6));

  const candidatos: DocFonte[] = [];
  if (escopo !== "clientes") candidatos.push(...(await docsAcervo(ctx.supabase, tipos)));
  if (escopo !== "acervo") candidatos.push(...(await docsClientes(ctx.supabase)));
  if (!candidatos.length) return json({ resultado: "Não há documentos para pesquisar nesse escopo." });

  // Quem tem o termo no nome/tipo vem primeiro (é o mais provável e o primeiro a ser lido).
  const afinidade = (d: DocFonte) => termos.reduce((s, t) => s + (semAcento(`${d.nome} ${nomeTipo(d.tipo)} ${d.tipo}`).includes(t) ? 1 : 0), 0);
  candidatos.sort((a, b) => afinidade(b) - afinidade(a));
  const { textos, naoLidos, lidosAgora } = await carregarTextos(ctx.supabase, candidatos, escopo === "acervo" ? 10 : 6);

  const pontuados = textos.map((t) => {
    const n = semAcento(t.texto);
    const porTermo = termos.map((term) => {
      const pos: number[] = [];
      let i = n.indexOf(term);
      while (i >= 0 && pos.length < 40) { pos.push(i); i = n.indexOf(term, i + term.length); }
      return pos;
    });
    const distintos = porTermo.filter((p) => p.length).length;
    const total = porTermo.reduce((s, p) => s + p.length, 0);
    return { t, porTermo, distintos, pontos: distintos * 20 + Math.min(total, 30) + afinidade(t) * 5 };
  }).filter((x) => x.distintos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, limite);

  const resultados = pontuados.map(({ t, porTermo }) => {
    const ancoras = porTermo.flat().sort((a, b) => a - b);
    const usados: number[] = [];
    const trechos: string[] = [];
    for (const i of ancoras) {
      if (usados.some((u) => Math.abs(u - i) < 260)) continue;
      usados.push(i);
      trechos.push(janela(t.texto, i, 110, 220));
      if (trechos.length >= 3) break;
    }
    return {
      documento: t.nome, tipo: nomeTipo(t.tipo), origem: t.origem === "documentos" ? "acervo" : "cliente", id: t.id,
      ...(t.validade ? { validade: t.validade } : {}),
      termos_achados: porTermo.map((p, i) => (p.length ? termos[i] : null)).filter(Boolean),
      trechos,
    };
  });

  return json({
    termos,
    escopo,
    encontrados: resultados.length,
    resultados,
    documentos_pesquisados: textos.length,
    lidos_agora: lidosAgora,
    ...(naoLidos.length ? { nao_lidos: naoLidos.slice(0, 8) } : {}),
    como_usar: resultados.length ? "Para ler um arquivo inteiro use ler_documento (origem e id acima). Cite o documento de onde veio a informação." : "Nada encontrado nesses documentos. Tente outros termos ou consulte o mapa (onde_encontrar).",
  });
}
