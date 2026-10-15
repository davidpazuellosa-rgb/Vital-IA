/* Modelo comum dos arquivos que a Vita gera (planilha, PDF e Word). */

export type Celula = string | number | boolean | null;
export type Tabela = { colunas: string[]; linhas: Celula[][] };

export type Bloco =
  | { tipo: "titulo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "tabela"; titulo?: string; tabela: Tabela };

export type DocumentoGerado = { titulo: string; blocos: Bloco[] };
export type FormatoArquivo = "xlsx" | "pdf" | "docx";

/** Remove caracteres de controle (inválidos em XML/PDF) e limita o tamanho. */
export const limparTexto = (s: unknown, max = 32_000): string =>
  String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "").slice(0, max);

export const escaparXml = (s: unknown): string =>
  limparTexto(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const EXTENSAO: Record<FormatoArquivo, string> = { xlsx: "xlsx", pdf: "pdf", docx: "docx" };
export const MIME: Record<FormatoArquivo, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Texto de uma célula para PDF/Word: números no padrão brasileiro (valores em R$ com duas casas) e Sim/Não. */
export function textoCelula(v: Celula | undefined, coluna: string): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") {
    const dinheiro = /valor|pre[cç]o|custo|total|montante|r\$/i.test(coluna);
    const decimal = !Number.isInteger(v);
    return decimal || dinheiro ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
  }
  return v;
}
