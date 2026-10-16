import origens from "./origens.json";

export type PlataformaDetectada = { id: string; nome: string; host: string };

/** Sistemas conhecidos que não são indexados (origens.json), mas que queremos reconhecer. */
const OUTROS_SISTEMAS: Array<{ id: string; nome: string; hosts: string[] }> = [
  { id: "comprasnet", nome: "Compras.gov.br", hosts: ["comprasnet.gov.br", "compras.gov.br", "cnetmobile.estaleiro.serpro.gov.br"] },
  { id: "ecompras-am", nome: "e-Compras AM", hosts: ["e-compras.am.gov.br"] },
  { id: "compras-manaus", nome: "Compras Manaus", hosts: ["compras.manaus.am.gov.br"] },
  { id: "petronect", nome: "Petronect", hosts: ["petronect.com.br"] },
];

const SISTEMAS = [...origens.map((o) => ({ id: o.id, nome: o.nome, hosts: o.hosts })), ...OUTROS_SISTEMAS];

/** "https://app2.licitardigital.com.br/x" → "app2.licitardigital.com.br" (sem www). */
export function hostDeLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    return new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** O host é igual ao alvo ou subdomínio dele (app2.licitardigital.com.br ∈ licitardigital.com.br). */
export function hostCasa(host: string, alvo: string): boolean {
  return host === alvo || host.endsWith(`.${alvo}`);
}

/** Descobre em que sistema a licitação acontece, pelo endereço de origem informado no PNCP. */
export function detectarPlataforma(linkOrigem: string | null | undefined): PlataformaDetectada | null {
  const host = hostDeLink(linkOrigem);
  if (!host) return null;
  const sistema = SISTEMAS.find((s) => s.hosts.some((h) => hostCasa(host, h)));
  return sistema ? { id: sistema.id, nome: sistema.nome, host } : null;
}

/** Link do sistema onde a disputa acontece (nulo se não veio ou se é o próprio PNCP, que já tem o botão dele). */
export function linkSistemaOrigem(linkOrigem: string | null | undefined): string | null {
  const host = hostDeLink(linkOrigem);
  if (!linkOrigem || !host || hostCasa(host, "pncp.gov.br")) return null;
  return /^https?:\/\//i.test(linkOrigem) ? linkOrigem : `https://${linkOrigem}`;
}

/** "Abrir no Compras.gov.br", "Abrir no Licitanet"; sistema desconhecido mostra o endereço. */
export function rotuloSistemaOrigem(linkOrigem: string | null | undefined): string {
  const p = detectarPlataforma(linkOrigem);
  if (p) return `Abrir no ${p.nome}`;
  const host = hostDeLink(linkOrigem);
  return host ? `Abrir em ${host}` : "Abrir no sistema de origem";
}
