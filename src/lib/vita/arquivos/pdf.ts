import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { limparTexto, textoCelula, type DocumentoGerado, type Tabela } from "./modelo";

/* PDF gerado com pdf-lib (fontes padrão, WinAnsi: acentos do português funcionam): título, textos com quebra de
 * linha, listas e tabelas com cabeçalho repetido a cada página. Caracteres fora do alfabeto Latin-1 viram "?". */

const VERDE = rgb(0.18, 0.44, 0.31);
const CINZA = rgb(0.45, 0.45, 0.45);
const TROCAS: Record<string, string> = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "✓": "OK", "✔": "OK", "✗": "x", "×": "x", "≠": "!=", " ": " ", "\t": " " };

export async function gerarPdf(doc: DocumentoGerado, geradoEm: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(limparTexto(doc.titulo, 200));
  pdf.setProducer("Vital.IA");
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const suportados = new Set(fonte.getCharacterSet());

  const limpar = (s: string) => Array.from(limparTexto(s)).map((c) => TROCAS[c] ?? (c === "\n" ? c : suportados.has(c.codePointAt(0)!) ? c : "?")).join("");

  const larga = doc.blocos.some((b) => b.tipo === "tabela" && b.tabela.colunas.length > 5);
  const [LARG, ALT] = larga ? [841.89, 595.28] : [595.28, 841.89];
  const M = 40;
  const util = LARG - M * 2;
  let pagina: PDFPage = pdf.addPage([LARG, ALT]);
  let y = ALT - M;

  const novaPagina = () => { pagina = pdf.addPage([LARG, ALT]); y = ALT - M; };
  const garantir = (altura: number) => { if (y - altura < M + 16) novaPagina(); };

  function quebrar(texto: string, f: PDFFont, tamanho: number, largura: number): string[] {
    const linhas: string[] = [];
    for (const par of limpar(texto).split(/\r?\n/)) {
      let atual = "";
      for (const palavra of par.split(/\s+/).filter(Boolean)) {
        const tentativa = atual ? `${atual} ${palavra}` : palavra;
        if (f.widthOfTextAtSize(tentativa, tamanho) <= largura) { atual = tentativa; continue; }
        if (atual) linhas.push(atual);
        let resto = palavra;
        while (f.widthOfTextAtSize(resto, tamanho) > largura && resto.length > 1) {
          let n = resto.length;
          while (n > 1 && f.widthOfTextAtSize(resto.slice(0, n), tamanho) > largura) n--;
          linhas.push(resto.slice(0, n));
          resto = resto.slice(n);
        }
        atual = resto;
      }
      linhas.push(atual);
    }
    return linhas;
  }

  function texto(t: string, o: { tamanho?: number; negrito?: boolean; indent?: number; depois?: number; cor?: ReturnType<typeof rgb> } = {}) {
    const tamanho = o.tamanho ?? 10.5;
    const f = o.negrito ? negrito : fonte;
    const alturaLinha = tamanho * 1.35;
    for (const linha of quebrar(t, f, tamanho, util - (o.indent ?? 0))) {
      garantir(alturaLinha);
      y -= alturaLinha;
      pagina.drawText(linha, { x: M + (o.indent ?? 0), y: y + tamanho * 0.25, size: tamanho, font: f, color: o.cor ?? rgb(0.1, 0.1, 0.1) });
    }
    y -= o.depois ?? 6;
  }

  function tabela(t: Tabela) {
    const tam = 8, linhaH = tam * 1.3, pad = 3;
    // largura de cada coluna proporcional ao conteúdo, ajustada para caber na página
    const naturais = t.colunas.map((c, i) => {
      const maior = Math.max(negrito.widthOfTextAtSize(limpar(c), tam), ...t.linhas.slice(0, 120).map((l) => fonte.widthOfTextAtSize(limpar(String(l[i] ?? "")).split("\n")[0].slice(0, 80), tam)));
      return Math.min(220, Math.max(38, maior + pad * 2 + 4));
    });
    const soma = naturais.reduce((a, b) => a + b, 0);
    const larg = naturais.map((w) => Math.max(34, (w / soma) * util));
    const escala = util / larg.reduce((a, b) => a + b, 0);
    const col = larg.map((w) => w * escala);

    const desenharLinha = (celulas: string[], cab: boolean, zebra: boolean) => {
      const f = cab ? negrito : fonte;
      const quebradas = celulas.map((c, i) => {
        const l = quebrar(c, f, tam, col[i] - pad * 2);
        return l.length > 12 ? [...l.slice(0, 11), `${l[11].slice(0, Math.max(0, l[11].length - 1))}…`.replace("…", "...")] : l;
      });
      const altura = Math.max(...quebradas.map((l) => l.length)) * linhaH + pad * 2;
      garantir(altura);
      let x = M;
      if (cab) pagina.drawRectangle({ x: M, y: y - altura, width: util, height: altura, color: VERDE });
      else if (zebra) pagina.drawRectangle({ x: M, y: y - altura, width: util, height: altura, color: rgb(0.95, 0.97, 0.96) });
      quebradas.forEach((linhas, i) => {
        linhas.forEach((l, k) => pagina.drawText(l, { x: x + pad, y: y - pad - (k + 1) * linhaH + tam * 0.3, size: tam, font: f, color: cab ? rgb(1, 1, 1) : rgb(0.1, 0.1, 0.1) }));
        x += col[i];
      });
      pagina.drawLine({ start: { x: M, y: y - altura }, end: { x: M + util, y: y - altura }, thickness: 0.4, color: rgb(0.8, 0.8, 0.8) });
      y -= altura;
    };

    const cabecalho = t.colunas.map(String);
    // cabeçalho + primeira linha juntos (evita cabeçalho sozinho no fim da página)
    garantir(linhaH * 4);
    desenharLinha(cabecalho, true, false);
    t.linhas.forEach((l, r) => {
      const celulas = t.colunas.map((c, i) => textoCelula(l[i], c));
      const alturaPrevista = linhaH * 2 + pad * 2;
      if (y - alturaPrevista < M + 16) { novaPagina(); desenharLinha(cabecalho, true, false); }
      desenharLinha(celulas, false, r % 2 === 1);
    });
    y -= 10;
  }

  // título
  texto(doc.titulo, { tamanho: 20, negrito: true, cor: VERDE, depois: 2 });
  texto(`Gerado pela Vita em ${geradoEm}`, { tamanho: 8.5, cor: CINZA, depois: 12 });
  for (const b of doc.blocos) {
    if (b.tipo === "titulo") { y -= 6; texto(b.texto, { tamanho: 14, negrito: true, cor: VERDE, depois: 4 }); }
    else if (b.tipo === "subtitulo") { y -= 4; texto(b.texto, { tamanho: 11.5, negrito: true, depois: 3 }); }
    else if (b.tipo === "paragrafo") texto(b.texto);
    else if (b.tipo === "lista") for (const it of b.itens) texto(`•  ${it}`, { indent: 10, depois: 2 });
    else { if (b.titulo) texto(b.titulo, { tamanho: 11.5, negrito: true, depois: 3 }); tabela(b.tabela); }
  }

  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawText(`Vital.IA  ·  ${limpar(doc.titulo).slice(0, 70)}`, { x: M, y: 20, size: 7.5, font: fonte, color: CINZA });
    const rotulo = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(rotulo, { x: LARG - M - fonte.widthOfTextAtSize(rotulo, 7.5), y: 20, size: 7.5, font: fonte, color: CINZA });
  });
  return pdf.save();
}
