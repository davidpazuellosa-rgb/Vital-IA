import { strToU8, zipSync } from "fflate";
import { escaparXml, limparTexto, type Tabela } from "./modelo";

/* Planilha .xlsx escrita à mão (OOXML mínimo): cabeçalho colorido, filtro, painel congelado e larguras de coluna. */

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const letra = (i: number): string => {
  let n = i + 1, s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

/** Nome de aba válido no Excel: até 31 caracteres, sem []:*?/\ e único. */
function nomeAba(bruto: string, usados: Set<string>): string {
  const base = limparTexto(bruto, 60).replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Planilha";
  let nome = base, i = 2;
  while (usados.has(nome.toLowerCase())) { const suf = ` (${i++})`; nome = base.slice(0, 31 - suf.length) + suf; }
  usados.add(nome.toLowerCase());
  return nome;
}

function xmlAba(t: Tabela): string {
  const larguras = t.colunas.map((c, i) => {
    const maior = Math.max(c.length, ...t.linhas.slice(0, 300).map((l) => String(l[i] ?? "").length));
    return Math.min(60, Math.max(10, Math.round(maior * 1.1) + 2));
  });
  const cel = (ref: string, v: unknown, estilo: number): string => {
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;
    if (v == null || v === "") return `<c r="${ref}" s="${estilo}"/>`;
    const txt = typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v);
    return `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(txt)}</t></is></c>`;
  };
  const cab = `<row r="1" ht="22" customHeight="1">${t.colunas.map((c, i) => cel(`${letra(i)}1`, c, 1)).join("")}</row>`;
  const corpo = t.linhas.map((l, r) => `<row r="${r + 2}">${t.colunas.map((_, i) => cel(`${letra(i)}${r + 2}`, l[i], 2)).join("")}</row>`).join("");
  const ultima = `${letra(Math.max(0, t.colunas.length - 1))}${t.linhas.length + 1}`;
  return (
    `${XML}<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` +
    `<sheetData>${cab}${corpo}</sheetData>${t.colunas.length ? `<autoFilter ref="A1:${ultima}"/>` : ""}</worksheet>`
  );
}

const ESTILOS =
  `${XML}<styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F6F4F"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export type ImagemGrafico = { titulo: string; png: Uint8Array; largura: number; altura: number };

/** Aba "Gráficos": cada gráfico é uma imagem fixa com o título numa célula acima. */
function abaGraficos(graficos: ImagemGrafico[]): { sheet: string; drawing: string; drawingRels: string } {
  const LARG_PX = 760;
  const alturas = graficos.map((g) => Math.round((LARG_PX * g.altura) / g.largura));
  const linhasPor = graficos.map((_, i) => Math.ceil(alturas[i] / 20) + 3);
  let inicio = 0;
  const comeco = linhasPor.map((l) => { const r = inicio; inicio += l; return r; });
  const titulos = graficos.map((g, i) => `<row r="${comeco[i] + 1}"><c r="A${comeco[i] + 1}" s="1" t="inlineStr"><is><t xml:space="preserve">${escaparXml(g.titulo || `Gráfico ${i + 1}`)}</t></is></c></row>`).join("");
  const sheet = `${XML}<worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="60" customWidth="1"/></cols><sheetData>${titulos}</sheetData><drawing r:id="rId1"/></worksheet>`;
  const ancoras = graficos.map((_, i) => {
    const cx = LARG_PX * 9525, cy = alturas[i] * 9525;
    return (
      `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${comeco[i] + 1}</xdr:row><xdr:rowOff>60000</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/>` +
      `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}" descr="${escaparXml(graficos[i].titulo)}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
      `<xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
      `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`
    );
  }).join("");
  const drawing = `${XML}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}">${ancoras}</xdr:wsDr>`;
  const drawingRels = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${graficos.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/image" Target="../media/grafico${i + 1}.png"/>`).join("")}</Relationships>`;
  return { sheet, drawing, drawingRels };
}

export function gerarXlsx(abas: Array<{ nome: string; tabela: Tabela }>, graficos: ImagemGrafico[] = []): Uint8Array {
  if (!abas.length && !graficos.length) throw new Error("Nada para a planilha.");
  const usados = new Set<string>();
  const nomes = abas.map((a) => nomeAba(a.nome, usados));
  const temGraficos = graficos.length > 0;
  if (temGraficos) nomes.push(nomeAba("Gráficos", usados));
  const total = nomes.length; // abas de dados + aba de gráficos
  const arquivos: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${temGraficos ? '<Default Extension="png" ContentType="image/png"/>' : ""}` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      nomes.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      (temGraficos ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : "") +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${nomes.map((n, i) => `<sheet name="${escaparXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      nomes.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${total + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(ESTILOS),
  };
  abas.forEach((a, i) => { arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(xmlAba(a.tabela)); });
  if (temGraficos) {
    const g = abaGraficos(graficos);
    arquivos[`xl/worksheets/sheet${total}.xml`] = strToU8(g.sheet);
    arquivos[`xl/worksheets/_rels/sheet${total}.xml.rels`] = strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
    arquivos["xl/drawings/drawing1.xml"] = strToU8(g.drawing);
    arquivos["xl/drawings/_rels/drawing1.xml.rels"] = strToU8(g.drawingRels);
    graficos.forEach((im, i) => { arquivos[`xl/media/grafico${i + 1}.png`] = im.png; });
  }
  return zipSync(arquivos, { level: 6 });
}
