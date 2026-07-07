export function formatarMoeda(valor: number | string | null): string {
  if (valor == null || valor === "") return "—";
  // Colunas `numeric` do Supabase chegam como string; coage antes de formatar.
  const n = typeof valor === "number" ? valor : Number(valor);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Acrescenta o parâmetro `download` a uma URL assinada do Supabase Storage.
 * Sem ele, o navegador renderiza o arquivo inline (ex.: PDF/XML) em vez de
 * baixar, porque a URL é cross-origin.
 */
export function comDownload(url: string, nomeArquivo: string): string {
  return url + (url.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(nomeArquivo);
}
