import { configEmpresa, ehEmpresaSlug, type ConfigEmpresa, type EmpresaSlug } from "@/lib/empresas";

/** Qual empresa a ferramenta deve usar: a pedida, ou a única do usuário. Com as duas e sem pedido, a Vita precisa perguntar. */
export function empresaAlvo(args: Record<string, unknown>, empresas: EmpresaSlug[] | undefined): { ok: true; slug: EmpresaSlug; cfg: ConfigEmpresa } | { ok: false; erro: string } {
  const minhas = empresas?.length ? empresas : (["vital-norte"] as EmpresaSlug[]);
  const pedida = ehEmpresaSlug(args.empresa) ? args.empresa : undefined;
  if (pedida) {
    return minhas.includes(pedida) ? { ok: true, slug: pedida, cfg: configEmpresa(pedida) } : { ok: false, erro: "O usuário não tem acesso a essa empresa." };
  }
  if (minhas.length === 1) return { ok: true, slug: minhas[0], cfg: configEmpresa(minhas[0]) };
  return { ok: false, erro: "O usuário tem duas empresas (Vital Norte e RM) e não disse de qual é este pedido. NÃO adivinhe: pergunte com `perguntar` (Vital Norte ou RM) e chame de novo com o campo `empresa`." };
}
