import { strToU8, zipSync } from "fflate";
import { escaparXml, limparTexto, textoCelula, type Celula, type DocumentoGerado, type Tabela } from "./modelo";

/* Documento Word .docx escrito à mão (OOXML mínimo): título, subtítulos, parágrafos, listas e tabelas. */

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const run = (t: string, extra = "") => `<w:r>${extra ? `<w:rPr>${extra}</w:rPr>` : ""}<w:t xml:space="preserve">${escaparXml(t)}</w:t></w:r>`;
const para = (conteudo: string, ppr = "") => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ""}${conteudo}</w:p>`;

/** Texto com quebras de linha vira vários <w:br/> dentro do mesmo parágrafo. */
const textoComQuebras = (t: string, extra = "") =>
  limparTexto(t).split(/\r?\n/).map((l) => run(l, extra)).join("<w:r><w:br/></w:r>");

function tabelaXml(t: Tabela, larguraTotal: number): string {
  const n = Math.max(1, t.colunas.length);
  const pesos = t.colunas.map((c, i) => Math.min(40, Math.max(6, c.length, ...t.linhas.slice(0, 80).map((l) => String(l[i] ?? "").length))));
  const soma = pesos.reduce((a, b) => a + b, 0) || n;
  const larg = pesos.map((p) => Math.max(700, Math.floor((p / soma) * larguraTotal)));
  const celula = (txt: Celula | undefined, i: number, cab: boolean) => {
    const v = cab ? String(txt ?? "") : textoCelula(txt, t.colunas[i]);
    const props = `<w:tcW w:w="${larg[i]}" w:type="dxa"/>${cab ? '<w:shd w:val="clear" w:color="auto" w:fill="2F6F4F"/>' : ""}`;
    const fmt = `<w:sz w:val="18"/>${cab ? '<w:b/><w:color w:val="FFFFFF"/>' : ""}`;
    return `<w:tc><w:tcPr>${props}</w:tcPr>${para(textoComQuebras(v, fmt), '<w:spacing w:before="20" w:after="20"/>')}</w:tc>`;
  };
  const linhaCab = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${t.colunas.map((c, i) => celula(c, i, true)).join("")}</w:tr>`;
  const linhas = t.linhas.map((l) => `<w:tr>${t.colunas.map((_, i) => celula(l[i], i, false)).join("")}</w:tr>`).join("");
  return (
    `<w:tbl><w:tblPr><w:tblStyle w:val="TabelaVita"/><w:tblW w:w="${larg.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${larg.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${linhaCab}${linhas}</w:tbl>`
  );
}

const ESTILOS =
  `${XML}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>` +
  `<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:b/><w:color w:val="2F6F4F"/><w:sz w:val="44"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="2F6F4F"/><w:sz w:val="32"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>` +
  `<w:style w:type="table" w:styleId="TabelaVita"><w:name w:val="Tabela Vita"/><w:tblPr><w:tblBorders>` +
  ["top", "left", "bottom", "right", "insideH", "insideV"].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`).join("") +
  `</w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;

export function gerarDocx(doc: DocumentoGerado, geradoEm: string): Uint8Array {
  const larga = doc.blocos.some((b) => b.tipo === "tabela" && b.tabela.colunas.length > 5);
  const [pw, ph, orient] = larga ? [16838, 11906, ' w:orient="landscape"'] : [11906, 16838, ""];
  const margem = 1134;
  const util = pw - margem * 2;

  const imagens: Array<{ nome: string; png: Uint8Array }> = [];
  const corpo: string[] = [para(run(doc.titulo, ""), '<w:pStyle w:val="Title"/>'), para(run(`Gerado pela Vita em ${geradoEm}`, '<w:color w:val="7F7F7F"/><w:sz w:val="18"/>'))];
  for (const b of doc.blocos) {
    if (b.tipo === "titulo") corpo.push(para(run(b.texto), '<w:pStyle w:val="Heading1"/>'));
    else if (b.tipo === "subtitulo") corpo.push(para(run(b.texto), '<w:pStyle w:val="Heading2"/>'));
    else if (b.tipo === "paragrafo") corpo.push(para(textoComQuebras(b.texto)));
    else if (b.tipo === "lista") for (const it of b.itens) corpo.push(para(run("•  ") + textoComQuebras(it), '<w:ind w:left="460" w:hanging="260"/><w:spacing w:after="40"/>'));
    else if (b.tipo === "grafico") {
      imagens.push({ nome: `grafico${imagens.length + 1}.png`, png: b.png });
      const n = imagens.length;
      const cx = Math.min(util * 635, 5_700_000), cy = Math.round((cx * b.altura) / b.largura);
      corpo.push(para(
        `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Gráfico ${n}" descr="${escaparXml(b.titulo ?? "Gráfico")}"/>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="grafico${n}.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="rIdImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`,
        '<w:spacing w:after="160"/>',
      ));
    } else {
      if (b.titulo) corpo.push(para(run(b.titulo), '<w:pStyle w:val="Heading2"/>'));
      corpo.push(tabelaXml(b.tabela, util), para(""));
    }
  }
  const documento =
    `${XML}<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${corpo.join("")}` +
    `<w:sectPr><w:pgSz w:w="${pw}" w:h="${ph}"${orient}/><w:pgMar w:top="${margem}" w:right="${margem}" w:bottom="${margem}" w:left="${margem}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  return zipSync({
    "[Content_Types].xml": strToU8(
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>` +
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
      `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(`${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/_rels/document.xml.rels": strToU8(
      `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      imagens.map((im, i) => `<Relationship Id="rIdImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.nome}"/>`).join("") + `</Relationships>`,
    ),
    ...Object.fromEntries(imagens.map((im) => [`word/media/${im.nome}`, im.png])),
    "word/styles.xml": strToU8(ESTILOS),
    "word/document.xml": strToU8(documento),
  }, { level: 6 });
}
