/* Gráficos da Vita: especificação (o que a Vita pede), formatação de valores e paleta. Seguro para navegador e servidor. */

/** Colunas = vertical; barras = horizontal. Os demais seguem a terminologia dos relatórios (resumo/KPI, tabela, combinação, dispersão, medidor). */
export type TipoGrafico =
  | "colunas" | "colunas_empilhadas" | "barras" | "linhas" | "area" | "pizza" | "rosca"
  | "kpi" | "tabela" | "combinacao" | "dispersao" | "medidor";
export type FormatoValor = "numero" | "moeda" | "percentual";

export type SerieGrafico = {
  nome: string;
  valores: number[];
  /** Só na combinação: a série vira coluna ou linha. */
  tipo?: "coluna" | "linha";
  /** Só na combinação: em qual eixo Y a série é lida. */
  eixo?: "esquerdo" | "direito";
  /** Formato próprio da série (padrão: o do gráfico). */
  formato?: FormatoValor;
  /** Só na dispersão: pontos [x, y] (e rótulos opcionais). */
  pontos?: Array<[number, number]>;
  rotulosPontos?: string[];
};

export type GraficoSpec = {
  id: string;
  tipo: TipoGrafico;
  titulo: string;
  categorias: string[];
  series: SerieGrafico[];
  formato: FormatoValor;
  rotuloX?: string;
  rotuloY?: string;
  /** Medidor: faixa e meta. */
  minimo?: number;
  maximo?: number;
  meta?: number;
};

export const TIPOS_GRAFICO: TipoGrafico[] = ["colunas", "colunas_empilhadas", "barras", "linhas", "area", "pizza", "rosca", "kpi", "tabela", "combinacao", "dispersao", "medidor"];
/** Nomes que a Vita (ou o usuário) pode usar e que viram o tipo certo. */
export const SINONIMOS_TIPO: Record<string, TipoGrafico> = {
  coluna: "colunas", barras_verticais: "colunas", barras_horizontais: "barras", barra: "barras", barras_empilhadas: "colunas_empilhadas", empilhadas: "colunas_empilhadas",
  linha: "linhas", donut: "rosca", resumo: "kpi", indicador: "kpi", gauge: "medidor", scatter: "dispersao", dispersão: "dispersao", combo: "combinacao", combinação: "combinacao", pie: "pizza",
};
export const MAX_CATEGORIAS = 40;
export const MAX_SERIES = 8;
export const MAX_PONTOS = 500;

export const PALETA = ["#2F6F4F", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6", "#EC4899", "#64748B", "#84CC16", "#F97316", "#0EA5E9", "#A855F7"];

export const ehPizza = (t: TipoGrafico) => t === "pizza" || t === "rosca";

/** Valor completo (tooltip, rótulos): R$ 1.234,50 · 12,5% · 1.234,5 */
export function formatarValor(v: number, formato: FormatoValor): string {
  if (!Number.isFinite(v)) return "—";
  if (formato === "moeda") return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (formato === "percentual") return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Valor curto para eixos e rótulos pequenos: 1,5 mil · 2 mi · R$ 3 mil */
export function formatarCompacto(v: number, formato: FormatoValor): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  let n: string;
  if (formato === "percentual") n = `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  else if (abs >= 1e9) n = `${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  else if (abs >= 1e6) n = `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  else if (abs >= 1e4) n = `${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  else n = v.toLocaleString("pt-BR", { maximumFractionDigits: abs < 10 && !Number.isInteger(v) ? 1 : 0 });
  return formato === "moeda" ? `R$ ${n}` : n;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Valida um GraficoSpec vindo de fora (ex.: do navegador): tipos, tamanhos e números. Devolve null se for inválido. */
export function validarSpec(x: unknown): GraficoSpec | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (!(TIPOS_GRAFICO as string[]).includes(String(o.tipo))) return null;
  if (!Array.isArray(o.categorias) || !Array.isArray(o.series)) return null;
  const tipo = o.tipo as TipoGrafico;
  const categorias = o.categorias.slice(0, MAX_CATEGORIAS).map((c) => String(c ?? "").slice(0, 80));
  const fmt = (f: unknown): FormatoValor | undefined => (["numero", "moeda", "percentual"].includes(String(f)) ? (f as FormatoValor) : undefined);
  const series: SerieGrafico[] = o.series.slice(0, MAX_SERIES).map((s, i) => {
    const so = (s ?? {}) as Record<string, unknown>;
    const valores = Array.isArray(so.valores) ? so.valores : [];
    const pontos = Array.isArray(so.pontos) ? so.pontos.slice(0, MAX_PONTOS).map((p) => [num((p as unknown[])?.[0]), num((p as unknown[])?.[1])] as [number, number]) : undefined;
    return {
      nome: String(so.nome ?? `Série ${i + 1}`).slice(0, 60),
      valores: tipo === "dispersao" ? [] : categorias.map((_, k) => num(valores[k])),
      ...(so.tipo === "coluna" || so.tipo === "linha" ? { tipo: so.tipo } : {}),
      ...(so.eixo === "esquerdo" || so.eixo === "direito" ? { eixo: so.eixo } : {}),
      ...(fmt(so.formato) ? { formato: fmt(so.formato) } : {}),
      ...(pontos ? { pontos } : {}),
      ...(Array.isArray(so.rotulosPontos) && pontos ? { rotulosPontos: so.rotulosPontos.slice(0, MAX_PONTOS).map((r) => String(r ?? "").slice(0, 60)) } : {}),
    };
  });
  if (!series.length) return null;
  if (tipo !== "dispersao" && !categorias.length) return null;
  if (tipo === "dispersao" && !series.some((s) => s.pontos?.length)) return null;
  const opc = (v: unknown) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? undefined : Number(v));
  return {
    id: String(o.id ?? "g").slice(0, 40), tipo, titulo: String(o.titulo ?? "").slice(0, 100), categorias, series, formato: fmt(o.formato) ?? "numero",
    rotuloX: o.rotuloX ? String(o.rotuloX).slice(0, 40) : undefined, rotuloY: o.rotuloY ? String(o.rotuloY).slice(0, 40) : undefined,
    minimo: opc(o.minimo), maximo: opc(o.maximo), meta: opc(o.meta),
  };
}
