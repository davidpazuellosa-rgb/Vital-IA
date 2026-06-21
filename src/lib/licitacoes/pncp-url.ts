/**
 * Monta o link direto para a página da licitação no portal do PNCP,
 * a partir do numeroControlePNCP ("CNPJ-1-SEQUENCIAL/ANO").
 * Ex.: 04104816000116-1-000117/2023 →
 *   https://pncp.gov.br/app/editais/04104816000116/2023/117
 */
export function linkPncp(numeroControlePNCP: string | null | undefined): string | null {
  if (!numeroControlePNCP) return null;
  const m = numeroControlePNCP.match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  if (!m) return null;
  const [, cnpj, sequencial, ano] = m;
  return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${Number(sequencial)}`;
}
