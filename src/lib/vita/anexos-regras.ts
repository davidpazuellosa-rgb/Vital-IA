/** Regras de anexos da Vita — compartilhadas entre navegador e servidor (sem dependências pesadas). */
export const MAX_ANEXOS = 8;
export const MAX_BYTES_ANEXO = 20 * 1024 * 1024;

/** Valor do atributo `accept` do seletor de arquivos. */
export const ACEITOS =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif,.xlsx,.csv,.docx,.txt,.md,.zip,application/pdf,application/zip,image/*";

export type TipoAnexo = "pdf" | "imagem" | "planilha" | "documento" | "texto" | "zip" | "nao_suportado";

export function tipoDoArquivo(nome: string, mime: string): TipoAnexo {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext)) return "imagem";
  if (["xlsx", "csv"].includes(ext)) return "planilha";
  if (ext === "docx") return "documento";
  if (ext === "zip" || mime === "application/zip" || mime === "application/x-zip-compressed") return "zip";
  if (["txt", "md", "json", "xml"].includes(ext) || mime.startsWith("text/")) return "texto";
  return "nao_suportado";
}

/** Motivo de recusa no navegador, ou null se o arquivo pode ser enviado. */
export function motivoRecusa(arquivo: { name: string; size: number; type: string }): string | null {
  const ext = arquivo.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "xls") return "Planilha .xls antiga: abra no Excel e salve como .xlsx.";
  if (ext === "doc") return "Word .doc antigo: salve como .docx.";
  if (tipoDoArquivo(arquivo.name, arquivo.type) === "nao_suportado") return "Formato não suportado (PDF, imagem, XLSX, CSV, DOCX, TXT ou ZIP).";
  if (arquivo.size > MAX_BYTES_ANEXO) return "Arquivo maior que 20 MB.";
  return null;
}

/* ---------------- arquivos sem extensão ou com nome estranho: descobre o tipo pelo conteúdo ---------------- */

const bytesComecam = (b: Uint8Array, ...sig: number[]) => sig.every((v, i) => b[i] === v);

/** Extensão e tipo reais de um arquivo, lendo o começo dele; null se não reconhecer. */
async function farejar(arquivo: File): Promise<{ ext: string; mime: string } | null> {
  const b = new Uint8Array(await arquivo.slice(0, 65_536).arrayBuffer());
  if (bytesComecam(b, 0x25, 0x50, 0x44, 0x46)) return { ext: "pdf", mime: "application/pdf" };
  if (bytesComecam(b, 0x89, 0x50, 0x4e, 0x47)) return { ext: "png", mime: "image/png" };
  if (bytesComecam(b, 0xff, 0xd8, 0xff)) return { ext: "jpg", mime: "image/jpeg" };
  if (bytesComecam(b, 0x47, 0x49, 0x46, 0x38)) return { ext: "gif", mime: "image/gif" };
  if (bytesComecam(b, 0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return { ext: "webp", mime: "image/webp" };
  if (String.fromCharCode(...b.slice(4, 8)) === "ftyp" && /hei|mif1|msf1/.test(String.fromCharCode(...b.slice(8, 12)))) return { ext: "heic", mime: "image/heic" };
  if (bytesComecam(b, 0x50, 0x4b, 0x03, 0x04)) { // zip: Word ou Excel guardam seus nomes internos no começo
    const t = String.fromCharCode(...b.slice(0, 8_192));
    if (t.includes("word/")) return { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (t.includes("xl/")) return { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    return { ext: "zip", mime: "application/zip" };
  }
  if (bytesComecam(b, 0xd0, 0xcf, 0x11, 0xe0)) return null; // .doc/.xls antigos
  if (b.length && !b.includes(0)) { // sem bytes nulos e texto válido: é texto
    try { new TextDecoder("utf-8", { fatal: true }).decode(b.slice(0, 8_000)); return { ext: "txt", mime: "text/plain" }; } catch { /* não é UTF-8 */ }
  }
  return null;
}

/** Se o arquivo não tem um formato reconhecido pelo nome, tenta pelo conteúdo e devolve com a extensão certa. */
export async function corrigirArquivo(arquivo: File): Promise<File> {
  if (tipoDoArquivo(arquivo.name, arquivo.type) !== "nao_suportado" || arquivo.size === 0) return arquivo;
  const real = await farejar(arquivo).catch(() => null);
  if (!real) return arquivo;
  return new File([arquivo], `${arquivo.name.replace(/\.[^./\\]{1,8}$/, "")}.${real.ext}`, { type: real.mime, lastModified: arquivo.lastModified });
}
