/** Regras de anexos da Vita — compartilhadas entre navegador e servidor (sem dependências pesadas). */
export const MAX_ANEXOS = 8;
export const MAX_BYTES_ANEXO = 20 * 1024 * 1024;

/** Valor do atributo `accept` do seletor de arquivos. */
export const ACEITOS =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.xlsx,.csv,.docx,.txt,.md,application/pdf,image/*";

export type TipoAnexo = "pdf" | "imagem" | "planilha" | "documento" | "texto" | "nao_suportado";

export function tipoDoArquivo(nome: string, mime: string): TipoAnexo {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext)) return "imagem";
  if (["xlsx", "csv"].includes(ext)) return "planilha";
  if (ext === "docx") return "documento";
  if (["txt", "md", "json", "xml"].includes(ext) || mime.startsWith("text/")) return "texto";
  return "nao_suportado";
}

/** Motivo de recusa no navegador, ou null se o arquivo pode ser enviado. */
export function motivoRecusa(arquivo: { name: string; size: number; type: string }): string | null {
  const ext = arquivo.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "xls") return "Planilha .xls antiga: abra no Excel e salve como .xlsx.";
  if (ext === "doc") return "Word .doc antigo: salve como .docx.";
  if (tipoDoArquivo(arquivo.name, arquivo.type) === "nao_suportado") return "Formato não suportado (PDF, imagem, XLSX, CSV, DOCX ou TXT).";
  if (arquivo.size > MAX_BYTES_ANEXO) return "Arquivo maior que 20 MB.";
  return null;
}
