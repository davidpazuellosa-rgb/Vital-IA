import { PALETA, ehPizza, formatarCompacto, formatarValor, type GraficoSpec, type SerieGrafico } from "./tipos";

/* ---------------------------------------------------------------------------------------------
 * Layout dos gráficos: transforma a especificação em primitivas geométricas numa área lógica de
 * LARGURA x ALTURA. O MESMO resultado é desenhado em SVG interativo (chat) e em PNG (arquivos exportados).
 * ------------------------------------------------------------------------------------------- */

export const LARGURA = 640;
export const ALTURA = 360;

export type Dica = { titulo: string; linhas: Array<{ cor: string; nome: string; valor: string }> };

export type Item =
  | { t: "texto"; x: number; y: number; texto: string; tam: number; cor: string; ancora: "start" | "middle" | "end"; negrito?: boolean; rotacao?: number }
  | { t: "linha"; x1: number; y1: number; x2: number; y2: number; cor: string; larg: number; tracejada?: boolean }
  | { t: "ret"; x: number; y: number; w: number; h: number; cor: string; raio?: number; opacidade?: number }
  | { t: "fatia"; cx: number; cy: number; r: number; r0: number; a0: number; a1: number; cor: string; dica: Dica; idx: number }
  | { t: "caminho"; pontos: Array<[number, number]>; cor: string; larg: number; preencher?: { baseY: number; opacidade: number } }
  | { t: "ponto"; x: number; y: number; r: number; cor: string; cheio?: boolean }
  | { t: "zona"; x: number; y: number; w: number; h: number; dica: Dica; guia?: { x: number; y1: number; y2: number } }
  | { t: "legenda"; x: number; y: number; w: number; h: number; cor: string; texto: string; idx: number; oculto: boolean };

export type Cena = { largura: number; altura: number; itens: Item[] };

const TEXTO = "#1f2937";
const SUAVE = "#6b7280";
const GRADE = "#e5e7eb";
const VERDE = PALETA[0];
const largTexto = (s: string, tam: number) => s.length * tam * 0.56;
const fmtS = (spec: GraficoSpec, s: SerieGrafico) => s.formato ?? spec.formato;
const corDe = (i: number) => PALETA[i % PALETA.length];

function cortar(s: string, maxPx: number, tam: number): string {
  if (largTexto(s, tam) <= maxPx) return s;
  const n = Math.max(1, Math.floor(maxPx / (tam * 0.56)) - 1);
  return `${s.slice(0, n)}…`;
}

/** Eixo "bonito": limites e passo redondos (1, 2, 5 × 10ⁿ). */
function eixoBonito(min: number, max: number, alvo = 5): { min: number; max: number; valores: number[] } {
  if (min === max) max = min + 1;
  const bruto = (max - min) / alvo;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / mag;
  const passo = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / passo) * passo;
  const hi = Math.ceil(max / passo) * passo;
  const valores: number[] = [];
  for (let v = lo; v <= hi + passo / 2; v += passo) valores.push(Number(v.toFixed(10)));
  return { min: lo, max: hi, valores };
}

/** Monta a cena. `ocultas`: séries (ou categorias, na pizza) escondidas pelo usuário na legenda. */
export function montarCena(spec: GraficoSpec, ocultas: ReadonlySet<number> = new Set()): Cena {
  const itens: Item[] = [];
  const W = LARGURA, H = ALTURA;
  const pizza = ehPizza(spec.tipo);

  let topo = 14;
  if (spec.titulo) { itens.push({ t: "texto", x: 16, y: 24, texto: cortar(spec.titulo, W - 32, 15), tam: 15, cor: TEXTO, ancora: "start", negrito: true }); topo = 40; }

  // legenda das séries (embaixo); a pizza tem a sua, ao lado
  const comLegenda = !["kpi", "tabela", "medidor"].includes(spec.tipo) && !pizza && spec.series.length > 1;
  let alturaLegenda = 0;
  if (comLegenda) {
    const nomes = spec.series.map((s) => s.nome);
    let x = 16, linhas = 1;
    const posicoes: Array<{ w: number; i: number }> = [];
    nomes.forEach((nome, i) => {
      const w = 14 + largTexto(cortar(nome, 150, 10.5), 10.5) + 16;
      if (x + w > W - 16) { x = 16; linhas++; }
      posicoes.push({ w, i }); x += w;
    });
    alturaLegenda = linhas * 18 + 6;
    let linhaAtual = 0, xAtual = 16;
    posicoes.forEach((p) => {
      if (xAtual + p.w > W - 16) { linhaAtual++; xAtual = 16; }
      itens.push({ t: "legenda", x: xAtual, y: H - alturaLegenda + 4 + linhaAtual * 18, w: p.w, h: 16, cor: corDe(p.i), texto: cortar(nomes[p.i], 150, 10.5), idx: p.i, oculto: ocultas.has(p.i) });
      xAtual += p.w;
    });
  }

  switch (spec.tipo) {
    case "pizza": case "rosca": montarPizza(spec, ocultas, itens, topo); break;
    case "barras": montarBarras(spec, ocultas, itens, topo, alturaLegenda); break;
    case "kpi": montarKpi(spec, itens, topo); break;
    case "tabela": montarTabela(spec, itens, topo); break;
    case "medidor": montarMedidor(spec, itens, topo); break;
    case "dispersao": montarDispersao(spec, ocultas, itens, topo, alturaLegenda); break;
    case "combinacao": montarCombinacao(spec, ocultas, itens, topo, alturaLegenda); break;
    default: montarColunasLinhas(spec, ocultas, itens, topo, alturaLegenda);
  }
  return { largura: W, altura: H, itens };
}

/* ------------------------------------ pizza / rosca ------------------------------------ */
function montarPizza(spec: GraficoSpec, ocultas: ReadonlySet<number>, itens: Item[], topo: number) {
  const W = LARGURA, H = ALTURA;
  const valores = (spec.series[0]?.valores ?? []).map((v, i) => (ocultas.has(i) ? 0 : Math.max(0, v)));
  const total = valores.reduce((a, b) => a + b, 0);
  const cx = 16 + (W * 0.5 - 16) / 2 + 10, cy = topo + (H - topo - 16) / 2;
  const r = Math.min((W * 0.5 - 32) / 2, (H - topo - 24) / 2);
  const r0 = spec.tipo === "rosca" ? r * 0.58 : 0;
  let ang = -Math.PI / 2;
  valores.forEach((v, i) => {
    if (v <= 0 || total <= 0) return;
    const fim = ang + (v / total) * Math.PI * 2;
    const pct = (v / total) * 100;
    itens.push({
      t: "fatia", cx, cy, r, r0, a0: ang, a1: fim, cor: corDe(i), idx: i,
      dica: { titulo: spec.categorias[i] ?? "", linhas: [{ cor: corDe(i), nome: spec.series[0]?.nome ?? "", valor: `${formatarValor(v, spec.formato)} (${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)` }] },
    });
    if (pct >= 6) {
      const m = (ang + fim) / 2, rr = r0 ? (r + r0) / 2 : r * 0.62;
      itens.push({ t: "texto", x: cx + Math.cos(m) * rr, y: cy + Math.sin(m) * rr + 4, texto: `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`, tam: 11, cor: "#ffffff", ancora: "middle", negrito: true });
    }
    ang = fim;
  });
  if (r0 && total > 0) itens.push({ t: "texto", x: cx, y: cy + 5, texto: formatarCompacto(total, spec.formato), tam: 14, cor: TEXTO, ancora: "middle", negrito: true });
  const lx = W * 0.5 + 24, passo = Math.min(22, (H - topo - 16) / Math.max(1, spec.categorias.length));
  const total0 = (spec.series[0]?.valores ?? []).reduce((a, b) => a + Math.max(0, b), 0) || 1;
  spec.categorias.forEach((c, i) => {
    const v = spec.series[0]?.valores[i] ?? 0;
    const rotulo = `${cortar(c, 150, 10.5)} — ${formatarCompacto(v, spec.formato)} (${((Math.max(0, v) / total0) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%)`;
    itens.push({ t: "legenda", x: lx, y: topo + 6 + i * passo, w: W - lx - 12, h: 18, cor: corDe(i), texto: cortar(rotulo, W - lx - 40, 10.5), idx: i, oculto: ocultas.has(i) });
  });
}

/* ------------------------------------- barras (horizontal) ------------------------------------- */
function montarBarras(spec: GraficoSpec, ocultas: ReadonlySet<number>, itens: Item[], topo: number, alturaLegenda: number) {
  const W = LARGURA, H = ALTURA;
  const visiveis = spec.series.map((s, i) => ({ s, i })).filter(({ i }) => !ocultas.has(i));
  const maxRot = Math.min(170, Math.max(...spec.categorias.map((c) => largTexto(c, 10.5)), 40));
  const esq = 16 + maxRot + 8, dir = 44, fundo = alturaLegenda + 34, topoPlot = topo + 4;
  const pw = W - esq - dir, ph = H - topoPlot - fundo;
  const vals = visiveis.flatMap(({ s }) => s.valores);
  const eixo = eixoBonito(Math.min(0, ...vals, 0), Math.max(0, ...vals, 0));
  const x = (v: number) => esq + ((v - eixo.min) / (eixo.max - eixo.min)) * pw;
  eixo.valores.forEach((v) => {
    itens.push({ t: "linha", x1: x(v), y1: topoPlot, x2: x(v), y2: topoPlot + ph, cor: v === 0 ? "#9ca3af" : GRADE, larg: 1 });
    itens.push({ t: "texto", x: x(v), y: topoPlot + ph + 14, texto: formatarCompacto(v, spec.formato), tam: 9.5, cor: SUAVE, ancora: "middle" });
  });
  if (spec.rotuloY || spec.rotuloX) itens.push({ t: "texto", x: esq + pw / 2, y: topoPlot + ph + 28, texto: spec.rotuloY ?? spec.rotuloX ?? "", tam: 10, cor: SUAVE, ancora: "middle" });
  const n = spec.categorias.length, banda = ph / Math.max(1, n);
  spec.categorias.forEach((c, k) => {
    const yb = topoPlot + k * banda;
    itens.push({ t: "texto", x: esq - 6, y: yb + banda / 2 + 3.5, texto: cortar(c, maxRot, 10.5), tam: 10.5, cor: TEXTO, ancora: "end" });
    const grupoH = Math.min(banda * 0.74, 34 * Math.max(1, visiveis.length));
    const barH = grupoH / Math.max(1, visiveis.length);
    visiveis.forEach(({ s, i }, j) => {
      const v = s.valores[k] ?? 0, x0 = x(0), x1 = x(v);
      const y0 = yb + (banda - grupoH) / 2 + j * barH;
      itens.push({ t: "ret", x: Math.min(x0, x1), y: y0 + 1, w: Math.max(1, Math.abs(x1 - x0)), h: Math.max(2, barH - 2), cor: corDe(i), raio: 2 });
      if (n * visiveis.length <= 14) itens.push({ t: "texto", x: v >= 0 ? x1 + 4 : x1 - 4, y: y0 + barH / 2 + 3.5, texto: formatarCompacto(v, spec.formato), tam: 9.5, cor: SUAVE, ancora: v >= 0 ? "start" : "end" });
    });
    itens.push({ t: "zona", x: 0, y: yb, w: W, h: banda, dica: { titulo: c, linhas: visiveis.map(({ s, i }) => ({ cor: corDe(i), nome: s.nome, valor: formatarValor(s.valores[k] ?? 0, fmtS(spec, s)) })) } });
  });
}

/* ------------------- colunas, empilhadas, linhas e área (eixo X = categorias) ------------------- */
function eixoXCategorias(spec: GraficoSpec, itens: Item[], esq: number, pw: number, topoPlot: number, ph: number, alturaRotulosX: number, girar: boolean) {
  const n = spec.categorias.length, banda = pw / Math.max(1, n);
  spec.categorias.forEach((c, k) => {
    const cx = esq + banda * (k + 0.5);
    if (girar) itens.push({ t: "texto", x: cx + 3, y: topoPlot + ph + 12, texto: cortar(c, 125, 10), tam: 10, cor: TEXTO, ancora: "end", rotacao: -38 });
    else itens.push({ t: "texto", x: cx, y: topoPlot + ph + 14, texto: cortar(c, banda - 4, 10), tam: 10, cor: TEXTO, ancora: "middle" });
  });
  if (spec.rotuloX) itens.push({ t: "texto", x: esq + pw / 2, y: topoPlot + ph + alturaRotulosX + 12, texto: spec.rotuloX, tam: 10, cor: SUAVE, ancora: "middle" });
}

function medidasX(spec: GraficoSpec, esq: number, dir: number) {
  const n = spec.categorias.length;
  const banda0 = (LARGURA - esq - dir) / Math.max(1, n);
  const maiorCat = Math.max(...spec.categorias.map((c) => largTexto(c, 10)), 10);
  const girar = maiorCat > banda0 * 0.92;
  return { girar, alturaRotulosX: girar ? Math.min(84, Math.min(maiorCat, 125) * 0.62 + 10) : 18 };
}

function montarColunasLinhas(spec: GraficoSpec, ocultas: ReadonlySet<number>, itens: Item[], topo: number, alturaLegenda: number) {
  const W = LARGURA, H = ALTURA;
  const visiveis = spec.series.map((s, i) => ({ s, i })).filter(({ i }) => !ocultas.has(i));
  const empilhado = spec.tipo === "colunas_empilhadas";
  const n = spec.categorias.length;

  const somas = spec.categorias.map((_, k) => ({
    pos: visiveis.reduce((a, { s }) => a + Math.max(0, s.valores[k] ?? 0), 0),
    neg: visiveis.reduce((a, { s }) => a + Math.min(0, s.valores[k] ?? 0), 0),
  }));
  const todos = visiveis.flatMap(({ s }) => s.valores);
  const maxV = empilhado ? Math.max(0, ...somas.map((s) => s.pos)) : Math.max(0, ...todos, 0);
  const minV = empilhado ? Math.min(0, ...somas.map((s) => s.neg)) : Math.min(0, ...todos, 0);
  const eixo = eixoBonito(minV, maxV);

  const maiorTickY = Math.max(...eixo.valores.map((v) => largTexto(formatarCompacto(v, spec.formato), 9.5)));
  const esq = 14 + maiorTickY + (spec.rotuloY ? 14 : 0), dir = 16;
  const { girar, alturaRotulosX } = medidasX(spec, esq, dir);
  const fundo = alturaRotulosX + (spec.rotuloX ? 14 : 0) + alturaLegenda + 8;
  const topoPlot = topo + 6;
  const pw = W - esq - dir, ph = H - topoPlot - fundo;
  const y = (v: number) => topoPlot + (1 - (v - eixo.min) / (eixo.max - eixo.min)) * ph;
  const banda = pw / Math.max(1, n);
  const xc = (k: number) => esq + banda * (k + 0.5);

  eixo.valores.forEach((v) => {
    itens.push({ t: "linha", x1: esq, y1: y(v), x2: esq + pw, y2: y(v), cor: v === 0 ? "#9ca3af" : GRADE, larg: 1 });
    itens.push({ t: "texto", x: esq - 6, y: y(v) + 3.5, texto: formatarCompacto(v, spec.formato), tam: 9.5, cor: SUAVE, ancora: "end" });
  });
  if (spec.rotuloY) itens.push({ t: "texto", x: 11, y: topoPlot + ph / 2, texto: spec.rotuloY, tam: 10, cor: SUAVE, ancora: "middle", rotacao: -90 });
  eixoXCategorias(spec, itens, esq, pw, topoPlot, ph, alturaRotulosX, girar);

  const dicaDe = (k: number): Dica => ({ titulo: spec.categorias[k] ?? "", linhas: visiveis.map(({ s, i }) => ({ cor: corDe(i), nome: s.nome, valor: formatarValor(s.valores[k] ?? 0, fmtS(spec, s)) })) });

  if (spec.tipo === "colunas" || empilhado) {
    for (let k = 0; k < n; k++) {
      if (empilhado) {
        let pos = 0, neg = 0;
        const largura = Math.min(banda * 0.62, 64);
        visiveis.forEach(({ s, i }) => {
          const v = s.valores[k] ?? 0;
          const a = v >= 0 ? pos : neg, b = a + v;
          if (v >= 0) pos = b; else neg = b;
          itens.push({ t: "ret", x: xc(k) - largura / 2, y: Math.min(y(a), y(b)), w: largura, h: Math.max(1, Math.abs(y(b) - y(a))), cor: corDe(i) });
        });
        if (n <= 14) itens.push({ t: "texto", x: xc(k), y: y(somas[k].pos) - 5, texto: formatarCompacto(somas[k].pos + somas[k].neg, spec.formato), tam: 9.5, cor: SUAVE, ancora: "middle" });
      } else {
        const grupo = Math.min(banda * 0.74, 70 * visiveis.length);
        const bw = grupo / Math.max(1, visiveis.length);
        visiveis.forEach(({ s, i }, j) => {
          const v = s.valores[k] ?? 0;
          const x0 = xc(k) - grupo / 2 + j * bw;
          itens.push({ t: "ret", x: x0 + 1, y: Math.min(y(0), y(v)), w: Math.max(1, bw - 2), h: Math.max(1, Math.abs(y(v) - y(0))), cor: corDe(i), raio: 2 });
          if (n * visiveis.length <= 14) itens.push({ t: "texto", x: x0 + bw / 2, y: v >= 0 ? y(v) - 4 : y(v) + 11, texto: formatarCompacto(v, spec.formato), tam: 9.5, cor: SUAVE, ancora: "middle" });
        });
      }
    }
  } else {
    visiveis.forEach(({ s, i }) => {
      const pts = spec.categorias.map((_, k) => [xc(k), y(s.valores[k] ?? 0)] as [number, number]);
      itens.push({ t: "caminho", pontos: pts, cor: corDe(i), larg: 2.4, preencher: spec.tipo === "area" ? { baseY: y(0), opacidade: 0.16 } : undefined });
      pts.forEach(([px, py]) => itens.push({ t: "ponto", x: px, y: py, r: n > 30 ? 1.6 : 3, cor: corDe(i) }));
    });
  }
  for (let k = 0; k < n; k++) itens.push({ t: "zona", x: esq + banda * k, y: topoPlot, w: banda, h: ph, dica: dicaDe(k), guia: { x: xc(k), y1: topoPlot, y2: topoPlot + ph } });
}

/* --------------------------- combinação: colunas + linha com dois eixos Y --------------------------- */
function montarCombinacao(spec: GraficoSpec, ocultas: ReadonlySet<number>, itens: Item[], topo: number, alturaLegenda: number) {
  const W = LARGURA, H = ALTURA;
  // padrão: primeira série = coluna no eixo esquerdo; as demais = linha no eixo direito
  const efetivas = spec.series.map((s, i) => ({ s, i, tipo: s.tipo ?? (i === 0 ? "coluna" : "linha"), eixo: s.eixo ?? (i === 0 ? "esquerdo" : "direito") }));
  const visiveis = efetivas.filter(({ i }) => !ocultas.has(i));
  const n = spec.categorias.length;
  const dominio = (eixo: "esquerdo" | "direito") => {
    const v = visiveis.filter((e) => e.eixo === eixo).flatMap((e) => e.s.valores);
    const colunas = visiveis.some((e) => e.eixo === eixo && e.tipo === "coluna");
    return eixoBonito(colunas ? Math.min(0, ...v, 0) : Math.min(...v, 0), Math.max(...v, 0));
  };
  const temDireito = visiveis.some((e) => e.eixo === "direito");
  const eixoE = dominio("esquerdo"), eixoD = dominio("direito");
  const fmtE = visiveis.find((e) => e.eixo === "esquerdo")?.s, fmtD = visiveis.find((e) => e.eixo === "direito")?.s;
  const fE = fmtE ? fmtS(spec, fmtE) : spec.formato, fD = fmtD ? fmtS(spec, fmtD) : spec.formato;

  const maiorE = Math.max(...eixoE.valores.map((v) => largTexto(formatarCompacto(v, fE), 9.5)));
  const maiorD = temDireito ? Math.max(...eixoD.valores.map((v) => largTexto(formatarCompacto(v, fD), 9.5))) : 0;
  const esq = 14 + maiorE + (spec.rotuloY ? 14 : 0), dir = temDireito ? 14 + maiorD : 16;
  const { girar, alturaRotulosX } = medidasX(spec, esq, dir);
  const fundo = alturaRotulosX + (spec.rotuloX ? 14 : 0) + alturaLegenda + 8;
  const topoPlot = topo + 6, pw = W - esq - dir, ph = H - topoPlot - fundo;
  const yE = (v: number) => topoPlot + (1 - (v - eixoE.min) / (eixoE.max - eixoE.min)) * ph;
  const yD = (v: number) => topoPlot + (1 - (v - eixoD.min) / (eixoD.max - eixoD.min)) * ph;
  const banda = pw / Math.max(1, n), xc = (k: number) => esq + banda * (k + 0.5);

  eixoE.valores.forEach((v) => {
    itens.push({ t: "linha", x1: esq, y1: yE(v), x2: esq + pw, y2: yE(v), cor: v === 0 ? "#9ca3af" : GRADE, larg: 1 });
    itens.push({ t: "texto", x: esq - 6, y: yE(v) + 3.5, texto: formatarCompacto(v, fE), tam: 9.5, cor: SUAVE, ancora: "end" });
  });
  if (temDireito) eixoD.valores.forEach((v) => itens.push({ t: "texto", x: esq + pw + 6, y: yD(v) + 3.5, texto: formatarCompacto(v, fD), tam: 9.5, cor: SUAVE, ancora: "start" }));
  if (spec.rotuloY) itens.push({ t: "texto", x: 11, y: topoPlot + ph / 2, texto: spec.rotuloY, tam: 10, cor: SUAVE, ancora: "middle", rotacao: -90 });
  eixoXCategorias(spec, itens, esq, pw, topoPlot, ph, alturaRotulosX, girar);

  const colunas = visiveis.filter((e) => e.tipo === "coluna");
  for (let k = 0; k < n; k++) {
    const grupo = Math.min(banda * 0.7, 64 * Math.max(1, colunas.length)), bw = grupo / Math.max(1, colunas.length);
    colunas.forEach(({ s, i, eixo }, j) => {
      const y = eixo === "direito" ? yD : yE, v = s.valores[k] ?? 0, x0 = xc(k) - grupo / 2 + j * bw;
      itens.push({ t: "ret", x: x0 + 1, y: Math.min(y(0), y(v)), w: Math.max(1, bw - 2), h: Math.max(1, Math.abs(y(v) - y(0))), cor: corDe(i), raio: 2, opacidade: 0.92 });
    });
  }
  visiveis.filter((e) => e.tipo === "linha").forEach(({ s, i, eixo }) => {
    const y = eixo === "direito" ? yD : yE;
    const pts = spec.categorias.map((_, k) => [xc(k), y(s.valores[k] ?? 0)] as [number, number]);
    itens.push({ t: "caminho", pontos: pts, cor: corDe(i), larg: 2.6 });
    pts.forEach(([px, py]) => itens.push({ t: "ponto", x: px, y: py, r: n > 30 ? 1.6 : 3.2, cor: corDe(i) }));
  });
  for (let k = 0; k < n; k++) {
    itens.push({
      t: "zona", x: esq + banda * k, y: topoPlot, w: banda, h: ph, guia: { x: xc(k), y1: topoPlot, y2: topoPlot + ph },
      dica: { titulo: spec.categorias[k] ?? "", linhas: visiveis.map(({ s, i }) => ({ cor: corDe(i), nome: s.nome, valor: formatarValor(s.valores[k] ?? 0, fmtS(spec, s)) })) },
    });
  }
}

/* -------------------------------------------- dispersão -------------------------------------------- */
function montarDispersao(spec: GraficoSpec, ocultas: ReadonlySet<number>, itens: Item[], topo: number, alturaLegenda: number) {
  const W = LARGURA, H = ALTURA;
  const visiveis = spec.series.map((s, i) => ({ s, i })).filter(({ i }) => !ocultas.has(i));
  const pontos = visiveis.flatMap(({ s }) => s.pontos ?? []);
  const xs = pontos.map((p) => p[0]), ys = pontos.map((p) => p[1]);
  const eX = eixoBonito(Math.min(...xs, 0 > Math.min(...xs) ? 0 : Math.min(...xs)), Math.max(...xs, 1)), eY = eixoBonito(Math.min(...ys, 0), Math.max(...ys, 1));
  const maiorY = Math.max(...eY.valores.map((v) => largTexto(formatarCompacto(v, spec.formato), 9.5)));
  const esq = 14 + maiorY + (spec.rotuloY ? 14 : 0), dir = 20, fundo = 24 + (spec.rotuloX ? 14 : 0) + alturaLegenda + 8, topoPlot = topo + 6;
  const pw = W - esq - dir, ph = H - topoPlot - fundo;
  const x = (v: number) => esq + ((v - eX.min) / (eX.max - eX.min)) * pw;
  const y = (v: number) => topoPlot + (1 - (v - eY.min) / (eY.max - eY.min)) * ph;
  eY.valores.forEach((v) => {
    itens.push({ t: "linha", x1: esq, y1: y(v), x2: esq + pw, y2: y(v), cor: GRADE, larg: 1 });
    itens.push({ t: "texto", x: esq - 6, y: y(v) + 3.5, texto: formatarCompacto(v, spec.formato), tam: 9.5, cor: SUAVE, ancora: "end" });
  });
  eX.valores.forEach((v) => {
    itens.push({ t: "linha", x1: x(v), y1: topoPlot, x2: x(v), y2: topoPlot + ph, cor: GRADE, larg: 1 });
    itens.push({ t: "texto", x: x(v), y: topoPlot + ph + 14, texto: formatarCompacto(v, "numero"), tam: 9.5, cor: SUAVE, ancora: "middle" });
  });
  if (spec.rotuloX) itens.push({ t: "texto", x: esq + pw / 2, y: topoPlot + ph + 30, texto: spec.rotuloX, tam: 10, cor: SUAVE, ancora: "middle" });
  if (spec.rotuloY) itens.push({ t: "texto", x: 11, y: topoPlot + ph / 2, texto: spec.rotuloY, tam: 10, cor: SUAVE, ancora: "middle", rotacao: -90 });
  visiveis.forEach(({ s, i }) => (s.pontos ?? []).forEach(([px, py], k) => {
    itens.push({ t: "ponto", x: x(px), y: y(py), r: 4.2, cor: corDe(i), cheio: true });
    itens.push({
      t: "zona", x: x(px) - 7, y: y(py) - 7, w: 14, h: 14,
      dica: { titulo: s.rotulosPontos?.[k] || s.nome, linhas: [{ cor: corDe(i), nome: spec.rotuloX || "X", valor: formatarValor(px, "numero") }, { cor: corDe(i), nome: spec.rotuloY || "Y", valor: formatarValor(py, fmtS(spec, s)) }] },
    });
  }));
}

/* -------------------------------------------- medidor -------------------------------------------- */
function montarMedidor(spec: GraficoSpec, itens: Item[], topo: number) {
  const W = LARGURA, H = ALTURA;
  const v = spec.series[0]?.valores[0] ?? 0;
  const min = spec.minimo ?? 0;
  const max = spec.maximo ?? spec.meta ?? Math.max(v * 1.25, 1);
  const pct = Math.max(0, Math.min(1, (v - min) / ((max - min) || 1)));
  const rel = spec.meta ? v / spec.meta : pct;
  const cor = spec.meta ? (rel < 0.5 ? "#EF4444" : rel < 0.8 ? "#F59E0B" : VERDE) : VERDE;
  const cx = W / 2, cy = topo + (H - topo) * 0.72, r = Math.min(W * 0.34, cy - topo - 8), r0 = r * 0.7;
  const dica = { titulo: spec.categorias[0] || spec.series[0]?.nome || "Valor", linhas: [{ cor, nome: spec.meta ? `Meta ${formatarValor(spec.meta, spec.formato)}` : `Faixa ${formatarCompacto(min, spec.formato)} a ${formatarCompacto(max, spec.formato)}`, valor: formatarValor(v, spec.formato) }] };
  itens.push({ t: "fatia", cx, cy, r, r0, a0: Math.PI, a1: Math.PI * 2, cor: "#e5e7eb", dica: { titulo: "", linhas: [] }, idx: 0 });
  if (pct > 0) itens.push({ t: "fatia", cx, cy, r, r0, a0: Math.PI, a1: Math.PI + pct * Math.PI, cor, dica, idx: 1 });
  itens.push({ t: "texto", x: cx, y: cy - 10, texto: formatarValor(v, spec.formato), tam: 30, cor: TEXTO, ancora: "middle", negrito: true });
  itens.push({ t: "texto", x: cx, y: cy + 14, texto: spec.meta ? `${(rel * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% da meta (${formatarCompacto(spec.meta, spec.formato)})` : (spec.categorias[0] || spec.series[0]?.nome || ""), tam: 11.5, cor: SUAVE, ancora: "middle" });
  itens.push({ t: "texto", x: cx - (r + r0) / 2, y: cy + 16, texto: formatarCompacto(min, spec.formato), tam: 10, cor: SUAVE, ancora: "middle" });
  itens.push({ t: "texto", x: cx + (r + r0) / 2, y: cy + 16, texto: formatarCompacto(max, spec.formato), tam: 10, cor: SUAVE, ancora: "middle" });
}

/* ----------------------------------------- resumo / KPI ----------------------------------------- */
function montarKpi(spec: GraficoSpec, itens: Item[], topo: number) {
  const W = LARGURA, H = ALTURA;
  // cada cartão: (a) uma série por cartão (nome = rótulo, valor único, formato próprio) ou (b) categorias + uma série
  const cartoes = spec.series.length > 1 && spec.categorias.length <= 1
    ? spec.series.map((s) => ({ rotulo: s.nome, v: s.valores[0] ?? 0, f: fmtS(spec, s) }))
    : spec.categorias.map((c, i) => ({ rotulo: c, v: spec.series[0]?.valores[i] ?? 0, f: spec.series[0] ? fmtS(spec, spec.series[0]) : spec.formato }));
  const n = Math.min(8, cartoes.length);
  const colunas = n <= 1 ? 1 : n <= 3 ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4;
  const linhas = Math.ceil(n / colunas), gap = 12;
  const cw = (W - 32 - gap * (colunas - 1)) / colunas, ch = Math.min(130, (H - topo - 16 - gap * (linhas - 1)) / linhas);
  const y0 = topo + Math.max(0, (H - topo - 16 - (ch * linhas + gap * (linhas - 1))) / 2);
  for (let i = 0; i < n; i++) {
    const x = 16 + (i % colunas) * (cw + gap), y = y0 + Math.floor(i / colunas) * (ch + gap);
    const texto = formatarValor(cartoes[i].v, cartoes[i].f);
    const tam = Math.max(16, Math.min(38, ch * 0.34, (cw - 28) / Math.max(4, texto.length * 0.58)));
    itens.push({ t: "ret", x, y, w: cw, h: ch, cor: "#f3f4f6", raio: 10 });
    itens.push({ t: "ret", x, y: y + 10, w: 4, h: ch - 20, cor: corDe(i), raio: 2 });
    itens.push({ t: "texto", x: x + 18, y: y + ch * 0.36, texto: cortar(cartoes[i].rotulo, cw - 30, 11.5), tam: 11.5, cor: SUAVE, ancora: "start" });
    itens.push({ t: "texto", x: x + 18, y: y + ch * 0.36 + tam + 6, texto, tam, cor: TEXTO, ancora: "start", negrito: true });
  }
}

/* -------------------------------------------- tabela -------------------------------------------- */
function montarTabela(spec: GraficoSpec, itens: Item[], topo: number) {
  const W = LARGURA, H = ALTURA;
  const MAX_LINHAS = 14;
  const total = spec.categorias.length, mostradas = Math.min(total, MAX_LINHAS);
  const series = spec.series.slice(0, 7);
  const x0 = 16, larguraTotal = W - 32;
  const larg1 = series.length ? Math.min(220, larguraTotal * 0.34) : larguraTotal;
  const largN = series.length ? (larguraTotal - larg1) / series.length : 0;
  const linhaH = Math.min(28, (H - topo - 16) / (mostradas + 1 + (total > mostradas ? 1 : 0)));
  const tam = linhaH < 20 ? 10 : 11.5;
  let y = topo;
  itens.push({ t: "ret", x: x0, y, w: larguraTotal, h: linhaH, cor: VERDE, raio: 4 });
  itens.push({ t: "texto", x: x0 + 8, y: y + linhaH / 2 + tam / 3, texto: cortar(spec.rotuloX ?? "", larg1 - 12, tam), tam, cor: "#ffffff", ancora: "start", negrito: true });
  series.forEach((s, j) => itens.push({ t: "texto", x: x0 + larg1 + largN * (j + 1) - 8, y: y + linhaH / 2 + tam / 3, texto: cortar(s.nome, largN - 12, tam), tam, cor: "#ffffff", ancora: "end", negrito: true }));
  y += linhaH;
  for (let k = 0; k < mostradas; k++) {
    if (k % 2 === 1) itens.push({ t: "ret", x: x0, y, w: larguraTotal, h: linhaH, cor: "#f3f6f4" });
    itens.push({ t: "texto", x: x0 + 8, y: y + linhaH / 2 + tam / 3, texto: cortar(spec.categorias[k] ?? "", larg1 - 12, tam), tam, cor: TEXTO, ancora: "start" });
    series.forEach((s, j) => itens.push({ t: "texto", x: x0 + larg1 + largN * (j + 1) - 8, y: y + linhaH / 2 + tam / 3, texto: cortar(formatarValor(s.valores[k] ?? 0, fmtS(spec, s)), largN - 12, tam), tam, cor: TEXTO, ancora: "end" }));
    itens.push({ t: "linha", x1: x0, y1: y + linhaH, x2: x0 + larguraTotal, y2: y + linhaH, cor: GRADE, larg: 1 });
    y += linhaH;
  }
  if (total > mostradas) itens.push({ t: "texto", x: x0 + 8, y: y + linhaH / 2 + tam / 3, texto: `… e mais ${total - mostradas} linha(s)`, tam, cor: SUAVE, ancora: "start" });
}
