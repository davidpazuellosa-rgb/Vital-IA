import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import type { EmpresaDados } from "@/lib/empresa/actions";
import type { AnaliseEdital } from "./analise-edital";
import type { PropostaConfiguracao } from "./types";

export type ItemPropostaPdf = {
  numeroItem: number;
  descricao: string;
  quantidade: number;
  unidadeMedida: string;
  marca: string;
  valorUnitario: number;
};

export type LicitacaoPropostaPdf = {
  titulo: string;
  descricao: string;
  orgao: string;
  modalidade: string;
  numero_controle_pncp: string;
  municipio: string;
  uf: string;
};

export type AnexoPdf = { nome: string; bytes: Uint8Array };

type Contexto = {
  doc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
  pagina: number;
};

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 48;
const VERDE = rgb(0.035, 0.58, 0.42);
const TEXTO = rgb(0.09, 0.14, 0.13);
const CINZA = rgb(0.39, 0.45, 0.43);
const FUNDO = rgb(0.95, 0.97, 0.96);

export async function gerarPdfProposta({
  empresa,
  configuracao,
  licitacao,
  analise,
  itens,
  imagemApoio,
  anexos,
  declaracoesAssinadas,
}: {
  empresa: EmpresaDados;
  configuracao: PropostaConfiguracao;
  licitacao: LicitacaoPropostaPdf;
  analise: AnaliseEdital;
  itens: ItemPropostaPdf[];
  imagemApoio?: { nome: string; tipo: string; bytes: Uint8Array } | null;
  anexos?: AnexoPdf[];
  declaracoesAssinadas?: AnexoPdf | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(A4);
  const ctx: Contexto = { doc, page, regular, bold, y: 788, pagina: 1 };

  cabecalho(ctx, empresa.nome_fantasia || empresa.razao_social || "Vital Norte");
  titulo(ctx, "PROPOSTA COMERCIAL");
  texto(ctx, `${limpar(licitacao.modalidade)} - ${limpar(licitacao.numero_controle_pncp)}`, { bold: true, size: 10, align: "center" });
  texto(ctx, `A ${limpar(licitacao.orgao)}`, { align: "center", color: CINZA });
  espaco(ctx, 8);
  texto(ctx, limpar(licitacao.descricao || licitacao.titulo), { size: 9, lineHeight: 13 });

  secao(ctx, "1. IDENTIFICAÇÃO DA EMPRESA PROPONENTE");
  campo(ctx, "Razão Social", empresa.razao_social);
  campo(ctx, "Nome Fantasia", empresa.nome_fantasia);
  campo(ctx, "CNPJ", empresa.cnpj);
  campo(ctx, "Endereço", enderecoEmpresa(empresa));
  campo(ctx, "Telefone / E-mail", [empresa.telefone, empresa.email].filter(Boolean).join(" | "));
  campo(ctx, "Representante legal", `${configuracao.representante_legal}${configuracao.representante_cargo ? ` - ${configuracao.representante_cargo}` : ""}`);
  campo(ctx, "Inscrição Estadual", empresa.inscricao_estadual);
  campo(ctx, "Inscrição Municipal", empresa.inscricao_municipal);
  campo(ctx, "Porte", empresa.porte);

  secao(ctx, "2. QUADRO DE PREÇOS POR ITEM");
  tabelaItens(ctx, itens);
  const total = itens.reduce((soma, item) => soma + item.quantidade * item.valorUnitario, 0);
  espaco(ctx, 5);
  caixaTotal(ctx, total);
  if (configuracao.observacoes_padrao) texto(ctx, configuracao.observacoes_padrao, { size: 8, color: CINZA });

  if (ctx.y < 230) novaPagina(ctx);
  secao(ctx, "3. CONDIÇÕES COMERCIAIS");
  campo(ctx, "Validade da proposta", `${configuracao.validade_dias || 60} dias`);
  for (const condicao of analise.condicoes) campo(ctx, condicao.nome, resumir(condicao.trecho, 280));
  if (licitacao.municipio || licitacao.uf) campo(ctx, "Local da contratação", [licitacao.municipio, licitacao.uf].filter(Boolean).join("/"));
  campo(ctx, "Dados bancários", empresa.dados_bancarios);
  campo(ctx, "Tributos e despesas", configuracao.impostos_inclusos ? "Inclusos nos preços apresentados." : "Conforme condições do edital.");

  secao(ctx, "4. DECLARAÇÕES");
  const declaracoes = analise.declaracoes.length > 0 ? analise.declaracoes : [{ nome: "Declaração de atendimento ao edital e ao Termo de Referência" }];
  declaracoes.forEach((item, indice) => paragrafoNumerado(ctx, indice + 1, declaracaoSegura(item.nome)));
  paragrafoNumerado(ctx, declaracoes.length + 1, "Declaramos que examinamos o edital e seus anexos e que os preços contemplam todos os custos necessários ao cumprimento da contratação.");

  if (!declaracoesAssinadas) {
    adicionarPaginasDeclaracoes(ctx, { empresa, configuracao, licitacao, analise });
  }

  secao(ctx, "5. LOCAL, DATA E ASSINATURA");
  texto(ctx, `${empresa.municipio || licitacao.municipio}, ${formatarData(new Date())}.`, { align: "center" });
  espaco(ctx, 32);
  linhaAssinatura(ctx, configuracao.representante_legal, configuracao.representante_cargo, empresa.razao_social);

  if (imagemApoio) await adicionarImagemApoio(ctx, imagemApoio);

  if (anexos?.length) {
    novaPagina(ctx);
    titulo(ctx, "6. DOCUMENTAÇÃO DE HABILITAÇÃO");
    texto(ctx, "Documentos exigidos no edital, disponíveis e válidos no acervo da empresa.", { align: "center", color: CINZA });
    espaco(ctx, 14);
    anexos.forEach((anexo, indice) => texto(ctx, `${indice + 1}. ${limpar(anexo.nome)}`, { size: 9 }));
    for (const anexo of anexos) {
      await anexarPdf(doc, anexo);
    }
  }

  if (declaracoesAssinadas) {
    novaPagina(ctx);
    titulo(ctx, "7. DECLARAÇÕES ASSINADAS");
    texto(ctx, "Caderno de declarações assinado e importado para esta proposta.", { align: "center", color: CINZA });
    espaco(ctx, 10);
    texto(ctx, declaracoesAssinadas.nome, { align: "center", size: 8, color: CINZA });
    await anexarPdf(doc, declaracoesAssinadas);
  }

  rodape(ctx);
  doc.setTitle(`Proposta - ${limpar(licitacao.numero_controle_pncp)}`);
  doc.setAuthor(empresa.razao_social || "Vital Norte");
  doc.setCreator("Vital.IA");
  return doc.save();
}

export async function gerarPdfDeclaracoes({
  empresa,
  configuracao,
  licitacao,
  analise,
}: {
  empresa: EmpresaDados;
  configuracao: PropostaConfiguracao;
  licitacao: LicitacaoPropostaPdf;
  analise: AnaliseEdital;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(A4);
  const ctx: Contexto = { doc, page, regular, bold, y: 788, pagina: 1 };

  cabecalho(ctx, empresa.nome_fantasia || empresa.razao_social || "Vital Norte");
  titulo(ctx, "CADERNO DE DECLARAÇÕES");
  texto(ctx, limpar(licitacao.descricao || licitacao.titulo), { size: 9, lineHeight: 13, align: "center" });
  texto(ctx, limpar(licitacao.modalidade) + " - " + limpar(licitacao.numero_controle_pncp), { size: 8, align: "center", color: CINZA });
  espaco(ctx, 12);
  texto(ctx, "Este arquivo reúne as declarações identificadas no edital em páginas individuais, para conferência e assinatura do representante legal.", { size: 9, lineHeight: 13 });

  adicionarPaginasDeclaracoes(ctx, { empresa, configuracao, licitacao, analise });
  rodape(ctx);
  doc.setTitle("Declarações - " + limpar(licitacao.numero_controle_pncp));
  doc.setAuthor(empresa.razao_social || "Vital Norte");
  doc.setCreator("Vital.IA");
  return doc.save();
}

async function anexarPdf(doc: PDFDocument, anexo: AnexoPdf) {
  try {
    const origem = await PDFDocument.load(anexo.bytes, { ignoreEncryption: true });
    const paginas = await doc.copyPages(origem, origem.getPageIndices());
    paginas.forEach((pagina) => doc.addPage(pagina));
  } catch {
    // Um anexo corrompido não deve impedir a geração da proposta comercial.
  }
}

function adicionarPaginasDeclaracoes(
  ctx: Contexto,
  {
    empresa,
    configuracao,
    licitacao,
    analise,
  }: {
    empresa: EmpresaDados;
    configuracao: PropostaConfiguracao;
    licitacao: LicitacaoPropostaPdf;
    analise: AnaliseEdital;
  },
) {
  const declaracoes = declaracoesParaAssinatura(analise);
  declaracoes.forEach((declaracao, indice) => {
    novaPagina(ctx);
    titulo(ctx, "DECLARAÇÃO " + (indice + 1));
    texto(ctx, declaracao.titulo, { bold: true, align: "center", size: 11 });
    espaco(ctx, 10);
    campo(ctx, "Licitação", licitacao.numero_controle_pncp);
    campo(ctx, "Órgão", licitacao.orgao);
    campo(ctx, "Empresa", [empresa.razao_social, empresa.cnpj && "CNPJ " + empresa.cnpj].filter(Boolean).join(" - "));
    espaco(ctx, 12);
    texto(ctx, declaracao.texto, { size: 10, lineHeight: 15 });
    if (declaracao.fonte) {
      espaco(ctx, 8);
      texto(ctx, "Fonte no edital: " + resumir(declaracao.fonte, 500), { size: 7.5, lineHeight: 11, color: CINZA });
    }
    espaco(ctx, 28);
    texto(ctx, (empresa.municipio || licitacao.municipio) + ", " + formatarData(new Date()) + ".", { align: "center" });
    espaco(ctx, 34);
    linhaAssinatura(ctx, configuracao.representante_legal || "David", configuracao.representante_cargo, empresa.razao_social);
  });
}

function declaracoesParaAssinatura(analise: AnaliseEdital): Array<{ titulo: string; texto: string; fonte: string }> {
  const base = analise.declaracoes.length > 0
    ? analise.declaracoes.map((item) => ({ titulo: item.nome, texto: declaracaoSegura(item.nome), fonte: item.trecho }))
    : [{
      titulo: "Declaração de atendimento ao edital e ao Termo de Referência",
      texto: declaracaoSegura("Declaração de atendimento ao edital e ao Termo de Referência"),
      fonte: "",
    }];
  return [
    ...base,
    {
      titulo: "Declaração de ciência dos custos da contratação",
      texto: "Declaramos que examinamos o edital e seus anexos e que os preços contemplam todos os custos necessários ao cumprimento da contratação.",
      fonte: "",
    },
  ];
}

function cabecalho(ctx: Contexto, empresa: string) {
  ctx.page.drawRectangle({ x: 0, y: 817, width: A4[0], height: 25, color: VERDE });
  ctx.page.drawText(limpar(empresa).toUpperCase(), { x: MARGEM, y: 825, size: 8, font: ctx.bold, color: rgb(1, 1, 1) });
}

function rodape(ctx: Contexto) {
  ctx.page.drawLine({ start: { x: MARGEM, y: 30 }, end: { x: A4[0] - MARGEM, y: 30 }, thickness: 0.5, color: rgb(0.82, 0.86, 0.85) });
  ctx.page.drawText(`Vital.IA  |  Proposta comercial  |  ${ctx.pagina}`, { x: MARGEM, y: 17, size: 7, font: ctx.regular, color: CINZA });
}

function novaPagina(ctx: Contexto) {
  rodape(ctx);
  ctx.page = ctx.doc.addPage(A4);
  ctx.pagina += 1;
  ctx.y = 788;
  cabecalho(ctx, "VITAL NORTE");
}

function garantir(ctx: Contexto, altura: number) {
  if (ctx.y - altura < 48) novaPagina(ctx);
}

function espaco(ctx: Contexto, altura: number) {
  garantir(ctx, altura);
  ctx.y -= altura;
}

function titulo(ctx: Contexto, valor: string) {
  garantir(ctx, 34);
  ctx.page.drawText(limpar(valor), { x: MARGEM, y: ctx.y, size: 16, font: ctx.bold, color: TEXTO });
  ctx.y -= 24;
}

function secao(ctx: Contexto, valor: string) {
  garantir(ctx, 38);
  ctx.y -= 10;
  ctx.page.drawRectangle({ x: MARGEM, y: ctx.y - 3, width: A4[0] - MARGEM * 2, height: 22, color: FUNDO });
  ctx.page.drawRectangle({ x: MARGEM, y: ctx.y - 3, width: 3, height: 22, color: VERDE });
  ctx.page.drawText(limpar(valor), { x: MARGEM + 11, y: ctx.y + 4, size: 10, font: ctx.bold, color: TEXTO });
  ctx.y -= 16;
}

function texto(ctx: Contexto, valor: string, opcoes: { size?: number; lineHeight?: number; bold?: boolean; align?: "left" | "center"; color?: ReturnType<typeof rgb> } = {}) {
  const size = opcoes.size ?? 9;
  const lineHeight = opcoes.lineHeight ?? size + 4;
  const font = opcoes.bold ? ctx.bold : ctx.regular;
  const linhas = quebrar(limpar(valor || "-"), font, size, A4[0] - MARGEM * 2);
  garantir(ctx, linhas.length * lineHeight + 3);
  for (const linha of linhas) {
    const largura = font.widthOfTextAtSize(linha, size);
    const x = opcoes.align === "center" ? (A4[0] - largura) / 2 : MARGEM;
    ctx.page.drawText(linha, { x, y: ctx.y, size, font, color: opcoes.color ?? TEXTO });
    ctx.y -= lineHeight;
  }
}

function campo(ctx: Contexto, rotulo: string, valor: string) {
  if (!valor) return;
  const label = `${limpar(rotulo)}: `;
  const tamanho = 8.5;
  const labelWidth = ctx.bold.widthOfTextAtSize(label, tamanho);
  const largura = A4[0] - MARGEM * 2 - labelWidth;
  const linhas = quebrar(limpar(valor), ctx.regular, tamanho, largura);
  garantir(ctx, linhas.length * 12 + 2);
  ctx.page.drawText(label, { x: MARGEM, y: ctx.y, size: tamanho, font: ctx.bold, color: TEXTO });
  linhas.forEach((linha, indice) => {
    ctx.page.drawText(linha, { x: indice === 0 ? MARGEM + labelWidth : MARGEM + labelWidth, y: ctx.y, size: tamanho, font: ctx.regular, color: TEXTO });
    ctx.y -= 12;
  });
}

function tabelaItens(ctx: Contexto, itens: ItemPropostaPdf[]) {
  const x = [MARGEM, 72, 322, 365, 418, 492];
  const headers = ["Item", "Descrição / Marca", "Qtd.", "Unid.", "Unitário", "Total"];
  desenharLinhaTabela(ctx, headers, x, true, 22);
  for (const item of itens) {
    const descricao = `${item.descricao}${item.marca ? ` | Marca: ${item.marca}` : ""}`;
    const linhasDescricao = quebrar(limpar(descricao), ctx.regular, 7.2, x[2] - x[1] - 8);
    const altura = Math.max(24, linhasDescricao.length * 9 + 8);
    garantir(ctx, altura + 2);
    const yTopo = ctx.y;
    const valores = [String(item.numeroItem), "", numeroBr(item.quantidade), limpar(item.unidadeMedida), moeda(item.valorUnitario), moeda(item.quantidade * item.valorUnitario)];
    ctx.page.drawRectangle({ x: MARGEM, y: yTopo - altura + 5, width: A4[0] - MARGEM * 2, height: altura, borderWidth: 0.5, borderColor: rgb(0.82, 0.86, 0.85) });
    linhasDescricao.forEach((linha, indice) => ctx.page.drawText(linha, { x: x[1] + 4, y: yTopo - 7 - indice * 9, size: 7.2, font: ctx.regular, color: TEXTO }));
    valores.forEach((valor, indice) => {
      if (indice === 1) return;
      ctx.page.drawText(valor, { x: x[indice] + 3, y: yTopo - 7, size: 7, font: ctx.regular, color: TEXTO });
    });
    for (const divisor of x.slice(1)) ctx.page.drawLine({ start: { x: divisor, y: yTopo + 5 }, end: { x: divisor, y: yTopo - altura + 5 }, thickness: 0.4, color: rgb(0.84, 0.87, 0.86) });
    ctx.y -= altura;
  }
}

function desenharLinhaTabela(ctx: Contexto, valores: string[], x: number[], cabecalho: boolean, altura: number) {
  garantir(ctx, altura);
  ctx.page.drawRectangle({ x: MARGEM, y: ctx.y - altura + 5, width: A4[0] - MARGEM * 2, height: altura, color: cabecalho ? VERDE : undefined, borderWidth: 0.5, borderColor: VERDE });
  valores.forEach((valor, indice) => ctx.page.drawText(valor, { x: x[indice] + 3, y: ctx.y - 8, size: 6.5, font: ctx.bold, color: rgb(1, 1, 1) }));
  ctx.y -= altura;
}

function caixaTotal(ctx: Contexto, total: number) {
  garantir(ctx, 28);
  ctx.page.drawRectangle({ x: 330, y: ctx.y - 9, width: A4[0] - MARGEM - 330, height: 25, color: FUNDO, borderWidth: 0.7, borderColor: VERDE });
  ctx.page.drawText("VALOR GLOBAL", { x: 340, y: ctx.y, size: 8, font: ctx.bold, color: TEXTO });
  const valor = moeda(total);
  ctx.page.drawText(valor, { x: A4[0] - MARGEM - ctx.bold.widthOfTextAtSize(valor, 9) - 8, y: ctx.y, size: 9, font: ctx.bold, color: VERDE });
  ctx.y -= 24;
}

function paragrafoNumerado(ctx: Contexto, numero: number, valor: string) {
  texto(ctx, `${numero}. ${valor}`, { size: 8.5, lineHeight: 12 });
}

function linhaAssinatura(ctx: Contexto, nome: string, cargo: string, empresa: string) {
  garantir(ctx, 60);
  const x1 = 155;
  const x2 = A4[0] - 155;
  ctx.page.drawLine({ start: { x: x1, y: ctx.y }, end: { x: x2, y: ctx.y }, thickness: 0.7, color: TEXTO });
  ctx.y -= 13;
  texto(ctx, nome || "Representante legal", { bold: true, align: "center", size: 8.5 });
  texto(ctx, [cargo, empresa].filter(Boolean).join(" | "), { align: "center", size: 7.5, color: CINZA });
}

async function adicionarImagemApoio(ctx: Contexto, imagem: { nome: string; tipo: string; bytes: Uint8Array }) {
  try {
    const embutida = imagem.tipo === "image/png" ? await ctx.doc.embedPng(imagem.bytes) : await ctx.doc.embedJpg(imagem.bytes);
    novaPagina(ctx);
    titulo(ctx, "ANEXO - PLANILHA DE PREÇOS");
    texto(ctx, `Arquivo de apoio: ${imagem.nome}`, { size: 8, color: CINZA });
    const maxW = A4[0] - MARGEM * 2;
    const maxH = ctx.y - 55;
    const escala = Math.min(maxW / embutida.width, maxH / embutida.height, 1);
    const w = embutida.width * escala;
    const h = embutida.height * escala;
    ctx.page.drawImage(embutida, { x: (A4[0] - w) / 2, y: ctx.y - h - 8, width: w, height: h });
    ctx.y -= h + 15;
  } catch {
    // O quadro de preços continua sendo gerado mesmo se a imagem não puder ser embutida.
  }
}

function quebrar(valor: string, font: PDFFont, size: number, largura: number): string[] {
  const palavras = valor.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const candidata = atual ? `${atual} ${palavra}` : palavra;
    if (font.widthOfTextAtSize(candidata, size) <= largura) atual = candidata;
    else {
      if (atual) linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : ["-"];
}

function limpar(valor: string): string {
  return String(valor ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resumir(valor: string, maximo: number): string {
  const limpo = limpar(valor);
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 3)}...`;
}

function declaracaoSegura(nome: string): string {
  const valor = limpar(nome).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/atendimento|cumprimento|concordancia|termo de referencia/.test(valor)) return "Declaramos que atendemos integralmente ao edital, ao Termo de Referência e a seus anexos.";
  if (/fato impeditivo|inidoneidade/.test(valor)) return "Declaramos a inexistência de fato impeditivo à habilitação e que não fomos declarados inidôneos para licitar ou contratar.";
  if (/proposta independente|elaboracao independente/.test(valor)) return "Declaramos que esta proposta foi elaborada de maneira independente, nos termos exigidos pelo edital.";
  if (/trabalho escravo|discriminacao/.test(valor)) return "Declaramos que não utilizamos trabalho escravo ou análogo e que observamos as normas de combate à discriminação.";
  if (/pessoa com deficiencia|reserva de cargos|reabilitado/.test(valor)) return "Declaramos o cumprimento das exigências legais de reserva de cargos para pessoas com deficiência e reabilitados da Previdência Social.";
  if (/integralidade|custos trabalhistas|direitos trabalhistas/.test(valor)) return "Declaramos que a proposta contempla a integralidade dos custos necessários ao cumprimento dos direitos trabalhistas.";
  if (/vistoria|renuncia/.test(valor)) return "Declaramos ciência das condições de execução e atendimento às regras de vistoria ou renúncia previstas no edital.";
  return `Declaramos, sob as penas da lei, o cumprimento da exigência descrita no edital como: ${limpar(nome)}.`;
}

function enderecoEmpresa(empresa: EmpresaDados): string {
  const logradouro = [empresa.logradouro, empresa.numero, empresa.complemento].filter(Boolean).join(", ");
  const local = [empresa.bairro, empresa.municipio, empresa.uf, empresa.cep].filter(Boolean).join(" - ");
  return [logradouro, local].filter(Boolean).join(" | ");
}

function moeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
}

function numeroBr(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(valor || 0);
}

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(data);
}
