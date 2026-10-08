export type SistemaLicitacao = {
  id: string;
  user_id: string;
  nome: string;
  url: string;
  login: string;
  observacoes: string;
  ordem: number;
  created_at: string;
};

/** Host legível de uma URL ("https://www.e-compras.am.gov.br/x" → "e-compras.am.gov.br"). */
export function hostDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
