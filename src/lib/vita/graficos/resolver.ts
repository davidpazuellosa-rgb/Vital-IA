import type { ContextoFerramenta } from "../ferramentas";
import { consultarDados } from "../banco";
import { MAX_CATEGORIAS, MAX_PONTOS, MAX_SERIES, SINONIMOS_TIPO, TIPOS_GRAFICO, ehPizza, type FormatoValor, type GraficoSpec, type SerieGrafico, type TipoGrafico } from "./tipos";

/* ---------------------------------------------------------------------------------------------
 * Transforma o pedido da Vita num GraficoSpec validado. Formas de informar os dados:
 *   1) prontos: categorias + series (ex.: resultados de uma busca no PNCP), ou pontos (dispersão), ou valor (medidor);
 *   2) direto do banco: fonte_dados + agrupar_por + metrica/metricas — o servidor agrupa e soma (sem erro de conta).
 * ------------------------------------------------------------------------------------------- */

type Args = Record<string, unknown>;
type Metrica = { nome: string; metrica: "contar" | "somar" | "media"; coluna: string; tipo?: "coluna" | "linha"; eixo?: "esquerdo" | "direito"; formato?: FormatoValor };
type Resultado = { grafico: GraficoSpec; aviso?: string } | { erro: string };

const novoId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const texto = (v: unknown, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const numero = (v: unknown) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const ehFormato = (f: unknown): f is FormatoValor => ["numero", "moeda", "percentual"].includes(String(f));
const pareceDinheiro = (coluna: string) => /valor|pre[cç]o|custo|total|montante|receita/i.test(coluna);

/** "proposta_pronta" → "Proposta pronta"; datas ISO → dd/mm/aaaa; booleanos → Sim/Não. */
function rotulo(v: unknown): string {
  if (v == null || v === "") return "(vazio)";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  const t = /^[a-z0-9_]+$/.test(s) ? s.replace(/_/g, " ") : s;
  return texto(t.charAt(0).toUpperCase() + t.slice(1), 60);
}

function chavePeriodo(v: unknown, periodo: string): { chave: string; rotulo: string } {
  const s = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return { chave: s, rotulo: rotulo(v) };
  if (periodo === "ano") return { chave: s.slice(0, 4), rotulo: s.slice(0, 4) };
  if (periodo === "dia") return { chave: s.slice(0, 10), rotulo: `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` };
  return { chave: s.slice(0, 7), rotulo: `${s.slice(5, 7)}/${s.slice(0, 4)}` }; // mês
}

/** Traz as linhas da fonte de dados (mesmas regras do consultar_dados). */
async function linhasDaFonte(args: Args, colunas: string[], ctx: ContextoFerramenta, limite = 5_000): Promise<{ linhas: Array<Record<string, unknown>>; total: number } | { erro: string }> {
  const fonte = { ...(args.fonte_dados as Args), colunas: [...new Set(colunas.filter(Boolean))], limite };
  const bruto = JSON.parse(await consultarDados(fonte, ctx.supabase, ctx.empresas, limite)) as { erro?: string; total?: number; linhas?: Array<Record<string, unknown>> };
  if (bruto.erro) return { erro: bruto.erro };
  const linhas = bruto.linhas ?? [];
  if (!linhas.length) return { erro: "A consulta não trouxe nenhum registro: não há o que mostrar no gráfico." };
  return { linhas, total: bruto.total ?? linhas.length };
}

function metricasDe(args: Args): Metrica[] | { erro: string } {
  const lista = Array.isArray(args.metricas) ? (args.metricas as Args[]) : [{ metrica: args.metrica, coluna_valor: args.coluna_valor, nome: undefined }];
  const saida: Metrica[] = [];
  for (const m of lista.slice(0, MAX_SERIES)) {
    const metrica = (["contar", "somar", "media"].includes(String(m.metrica)) ? String(m.metrica) : "contar") as Metrica["metrica"];
    const coluna = texto(m.coluna_valor ?? m.coluna, 60);
    if (metrica !== "contar" && !coluna) return { erro: "Para somar ou tirar a média informe `coluna_valor`." };
    saida.push({
      nome: texto(m.nome, 60) || (metrica === "contar" ? "Quantidade" : `${metrica === "somar" ? "Total" : "Média"} de ${coluna.replace(/_/g, " ")}`),
      metrica, coluna,
      ...(m.tipo === "coluna" || m.tipo === "linha" ? { tipo: m.tipo } : {}),
      ...(m.eixo === "esquerdo" || m.eixo === "direito" ? { eixo: m.eixo } : {}),
      ...(ehFormato(m.formato) ? { formato: m.formato } : {}),
    });
  }
  return saida;
}

const valorMetrica = (m: Metrica, soma: number, n: number) => Math.round((m.metrica === "media" ? (n ? soma / n : 0) : soma) * 100) / 100;

export async function resolverGrafico(args: Args, ctx: ContextoFerramenta): Promise<Resultado> {
  const bruto = String(args.tipo ?? "").toLowerCase().trim();
  const tipo: TipoGrafico = (TIPOS_GRAFICO as string[]).includes(bruto) ? (bruto as TipoGrafico) : (SINONIMOS_TIPO[bruto] ?? "colunas");
  let formato: FormatoValor = ehFormato(args.formato_valor) ? args.formato_valor : "numero";
  const base = { id: novoId(), tipo, titulo: texto(args.titulo, 100), rotuloX: texto(args.rotulo_x, 40) || undefined, rotuloY: texto(args.rotulo_y, 40) || undefined };
  const comFonte = Boolean(args.fonte_dados && typeof args.fonte_dados === "object");

  /* ---------------- medidor ---------------- */
  if (tipo === "medidor") {
    let valor = args.valor !== undefined ? numero(args.valor) : NaN;
    let aviso: string | undefined;
    if (comFonte) {
      const metricas = metricasDe(args); if ("erro" in metricas) return metricas;
      const m = metricas[0];
      const r = await linhasDaFonte(args, [m.coluna], ctx); if ("erro" in r) return r;
      const soma = r.linhas.reduce((a, l) => a + (m.metrica === "contar" ? 1 : numero(l[m.coluna])), 0);
      valor = valorMetrica(m, soma, r.linhas.length);
      if (!args.formato_valor && m.metrica !== "contar" && pareceDinheiro(m.coluna)) formato = "moeda";
      if (r.total > r.linhas.length) aviso = `a consulta tem ${r.total} registros; considerei os primeiros ${r.linhas.length}`;
    }
    if (!Number.isFinite(valor)) return { erro: "Medidor: informe `valor` ou `fonte_dados` com `metrica`." };
    const meta = args.meta !== undefined ? numero(args.meta) : undefined;
    return { grafico: { ...base, titulo: base.titulo || "Medidor", categorias: [texto(args.rotulo_valor, 60) || ""], series: [{ nome: base.titulo || "Valor", valores: [valor] }], formato, minimo: args.minimo !== undefined ? numero(args.minimo) : undefined, maximo: args.maximo !== undefined ? numero(args.maximo) : undefined, meta }, aviso };
  }

  /* ---------------- dispersão ---------------- */
  if (tipo === "dispersao") {
    if (comFonte) {
      const ex = texto(args.eixo_x, 60), ey = texto(args.eixo_y, 60), rot = texto(args.rotulo_coluna, 60), seriePor = texto(args.serie_por, 60);
      if (!ex || !ey) return { erro: "Dispersão com `fonte_dados` precisa de `eixo_x` e `eixo_y` (colunas numéricas)." };
      const r = await linhasDaFonte(args, [ex, ey, rot, seriePor], ctx); if ("erro" in r) return r;
      const grupos = new Map<string, SerieGrafico>();
      for (const l of r.linhas) {
        const nome = seriePor ? rotulo(l[seriePor]) : "Registros";
        const s = grupos.get(nome) ?? { nome, valores: [], pontos: [], rotulosPontos: [] };
        if (s.pontos!.length < MAX_PONTOS) { s.pontos!.push([numero(l[ex]), numero(l[ey])]); s.rotulosPontos!.push(rot ? rotulo(l[rot]) : ""); }
        grupos.set(nome, s);
      }
      if (!args.formato_valor && pareceDinheiro(ey)) formato = "moeda";
      return { grafico: { ...base, titulo: base.titulo || `${ey.replace(/_/g, " ")} × ${ex.replace(/_/g, " ")}`, rotuloX: base.rotuloX ?? ex.replace(/_/g, " "), rotuloY: base.rotuloY ?? ey.replace(/_/g, " "), categorias: [], series: [...grupos.values()].slice(0, MAX_SERIES), formato }, aviso: r.total > r.linhas.length ? `a consulta tem ${r.total} registros; usei os primeiros ${r.linhas.length}` : undefined };
    }
    const series = (Array.isArray(args.series) ? args.series : []).slice(0, MAX_SERIES).map((s, i) => {
      const o = (s ?? {}) as Args;
      const pontos = (Array.isArray(o.pontos) ? o.pontos : []).slice(0, MAX_PONTOS).map((p) => [numero((p as unknown[])?.[0]), numero((p as unknown[])?.[1])] as [number, number]);
      return { nome: texto(o.nome, 60) || `Série ${i + 1}`, valores: [], pontos, ...(Array.isArray(o.rotulos) ? { rotulosPontos: o.rotulos.slice(0, MAX_PONTOS).map((x) => texto(x, 60)) } : {}) };
    }).filter((s) => s.pontos.length);
    if (!series.length) return { erro: "Dispersão: informe `series` com `pontos` ([x, y]) ou `fonte_dados` com `eixo_x` e `eixo_y`." };
    return { grafico: { ...base, titulo: base.titulo || "Dispersão", categorias: [], series, formato } };
  }

  /* ---------------- gráficos agrupados a partir do banco ---------------- */
  if (comFonte) {
    const metricas = metricasDe(args); if ("erro" in metricas) return metricas;
    const agrupar = texto(args.agrupar_por, 60);
    const seriePor = args.metricas ? "" : texto(args.serie_por, 60);
    const periodo = ["dia", "mes", "ano"].includes(String(args.periodo)) ? String(args.periodo) : "";
    const r = await linhasDaFonte(args, [agrupar, seriePor, ...metricas.map((m) => m.coluna)], ctx); if ("erro" in r) return r;
    const avisoTotal = r.total > r.linhas.length ? `a consulta tem ${r.total} registros; considerei os primeiros ${r.linhas.length}` : undefined;
    const geral = (m: Metrica) => valorMetrica(m, r.linhas.reduce((a, l) => a + (m.metrica === "contar" ? 1 : numero(l[m.coluna])), 0), r.linhas.length);
    const formatoDe = (m: Metrica): FormatoValor | undefined => m.formato ?? (m.metrica !== "contar" && pareceDinheiro(m.coluna) ? "moeda" : undefined);

    // KPI sem agrupamento: um cartão por métrica
    if (!agrupar) {
      if (tipo !== "kpi") return { erro: "Com `fonte_dados` informe `agrupar_por` (a coluna que vira as categorias)." };
      if (!args.formato_valor && metricas.every((m) => formatoDe(m) === "moeda")) formato = "moeda";
      return { grafico: { ...base, titulo: base.titulo || "Resumo", categorias: [""], series: metricas.map((m) => ({ nome: m.nome, valores: [geral(m)], ...(formatoDe(m) && formatoDe(m) !== formato ? { formato: formatoDe(m) } : {}) })), formato }, aviso: avisoTotal };
    }
    if (r.linhas[0] && !(agrupar in r.linhas[0])) return { erro: `A coluna "${agrupar}" não existe nessa tabela.` };

    type Acc = { soma: number; n: number };
    const acumulado = new Map<string, { rotulo: string; porSerie: Map<string, Acc> }>();
    const metricaDaSerie = new Map<string, Metrica>();
    for (const l of r.linhas) {
      const k = periodo ? chavePeriodo(l[agrupar], periodo) : { chave: String(l[agrupar] ?? ""), rotulo: rotulo(l[agrupar]) };
      const cat = acumulado.get(k.chave) ?? { rotulo: k.rotulo, porSerie: new Map() };
      const alvos = seriePor ? [{ nome: rotulo(l[seriePor]), m: metricas[0] }] : metricas.map((m) => ({ nome: m.nome, m }));
      for (const { nome, m } of alvos) {
        metricaDaSerie.set(nome, m);
        const acc = cat.porSerie.get(nome) ?? { soma: 0, n: 0 };
        acc.n += 1; acc.soma += m.metrica === "contar" ? 1 : numero(l[m.coluna]);
        cat.porSerie.set(nome, acc);
      }
      acumulado.set(k.chave, cat);
    }
    const valorDe = (nome: string, acc?: Acc) => (acc ? valorMetrica(metricaDaSerie.get(nome)!, acc.soma, acc.n) : 0);

    let nomes = [...metricaDaSerie.keys()];
    if (nomes.length > MAX_SERIES) {
      const total = (n: string) => [...acumulado.values()].reduce((s, c) => s + (c.porSerie.get(n)?.soma ?? 0), 0);
      nomes = nomes.sort((a, b) => total(b) - total(a)).slice(0, MAX_SERIES);
    }
    let cats = [...acumulado.entries()].map(([chave, c]) => ({ chave, ...c, total: nomes.reduce((s, n) => s + valorDe(n, c.porSerie.get(n)), 0) }));
    const ordemTempo = Boolean(periodo) || tipo === "linhas" || tipo === "area" || tipo === "combinacao";
    cats = ordemTempo ? cats.sort((a, b) => a.chave.localeCompare(b.chave)) : cats.sort((a, b) => b.total - a.total);

    const limite = Math.min(MAX_CATEGORIAS, Math.max(2, Number(args.limite_categorias) || (ehPizza(tipo) ? 10 : tipo === "kpi" ? 6 : 15)));
    const somarResto = !ordemTempo && nomes.every((n) => metricaDaSerie.get(n)!.metrica !== "media") && tipo !== "kpi";
    let aviso: string | undefined;
    let resto: typeof cats = [];
    if (cats.length > limite) {
      const manter = somarResto ? limite - 1 : limite;
      resto = cats.slice(manter); cats = cats.slice(0, manter);
      aviso = `havia ${cats.length + resto.length} categorias; ${somarResto ? 'as menores foram somadas em "Outros"' : "mostrei as primeiras"}`;
    }
    const categorias = cats.map((c) => c.rotulo);
    const series: SerieGrafico[] = nomes.map((n) => {
      const m = metricaDaSerie.get(n)!;
      const f = formatoDe(m);
      return { nome: n, valores: cats.map((c) => valorDe(n, c.porSerie.get(n))), ...(f && f !== formato ? { formato: f } : {}), ...(m.tipo ? { tipo: m.tipo } : {}), ...(m.eixo ? { eixo: m.eixo } : {}) };
    });
    if (resto.length && somarResto) {
      categorias.push("Outros");
      series.forEach((s) => s.valores.push(Math.round(resto.reduce((a, c) => a + valorDe(s.nome, c.porSerie.get(s.nome)), 0) * 100) / 100));
    }
    const principal = metricaDaSerie.get(nomes[0])!;
    if (!args.formato_valor && formatoDe(principal) === "moeda") { formato = "moeda"; series.forEach((s) => { if (s.formato === "moeda") delete s.formato; }); }
    const titulo = base.titulo || (metricas.length === 1 && !seriePor ? (principal.metrica === "contar" ? `Quantidade por ${agrupar.replace(/_/g, " ")}` : `${principal.nome} por ${agrupar.replace(/_/g, " ")}`) : `Por ${agrupar.replace(/_/g, " ")}`);
    return { grafico: { ...base, titulo, rotuloX: base.rotuloX, categorias, series: ehPizza(tipo) || tipo === "kpi" ? series.slice(0, 1) : series, formato }, aviso: [aviso, avisoTotal].filter(Boolean).join("; ") || undefined };
  }

  /* ---------------- dados prontos (colunas, barras, linhas, área, pizza, rosca, kpi, tabela, combinação) ---------------- */
  const categorias = Array.isArray(args.categorias) ? args.categorias.map((c) => rotulo(c)).slice(0, MAX_CATEGORIAS) : [];
  const series: SerieGrafico[] = (Array.isArray(args.series) ? args.series : []).slice(0, ehPizza(tipo) ? 1 : MAX_SERIES).map((s, i) => {
    const o = (s ?? {}) as Args;
    const valores = Array.isArray(o.valores) ? o.valores : [];
    return {
      nome: texto(o.nome, 60) || `Série ${i + 1}`, valores: categorias.map((_, k) => numero(valores[k])),
      ...(o.tipo === "coluna" || o.tipo === "linha" ? { tipo: o.tipo } : {}),
      ...(o.eixo === "esquerdo" || o.eixo === "direito" ? { eixo: o.eixo } : {}),
      ...(ehFormato(o.formato) ? { formato: o.formato } : {}),
    };
  });
  if (!categorias.length || !series.length) return { erro: "Informe `categorias` e `series` (cada série com `nome` e `valores`), ou use `fonte_dados` + `agrupar_por`." };
  return { grafico: { ...base, titulo: base.titulo || (tipo === "kpi" ? "Resumo" : "Gráfico"), categorias, series, formato } };
}
