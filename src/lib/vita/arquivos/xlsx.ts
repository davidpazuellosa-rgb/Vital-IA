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

export function gerarXlsx(abas: Array<{ nome: string; tabela: Tabela }>): Uint8Array {
  if (!abas.length) throw new Error("Nenhuma tabela para a planilha.");
  const usados = new Set<string>();
  const nomes = abas.map((a) => nomeAba(a.nome, usados));
  const arquivos: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(`${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${nomes.map((n, i) => `<sheet name="${escaparXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${abas.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/styles.xml": strToU8(ESTILOS),
  };
  abas.forEach((a, i) => { arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(xmlAba(a.tabela)); });
  return zipSync(arquivos, { level: 6 });
}
