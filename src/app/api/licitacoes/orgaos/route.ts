import { NextRequest, NextResponse } from "next/server";
import { tokensOrgao } from "@/lib/licitacoes/providers/pncp-client";

/**
 * Sugestões de órgãos para o campo "Órgão" da busca: pesquisa o nome na busca textual do
 * PNCP e devolve os órgãos distintos encontrados (com o nome OFICIAL, que é o que filtra bem).
 *   GET /api/licitacoes/orgaos?q=luisburgo
 */
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type ItemBusca = { orgao_nome?: string | null; orgao_cnpj?: string | null; uf?: string | null; municipio_nome?: string | null };

async function paginaBusca(q: string, pagina: number): Promise<ItemBusca[]> {
  const params = new URLSearchParams({ q, tipos_documento: "edital", ordenacao: "relevancia", pagina: String(pagina), tam_pagina: "50" });
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    if (tentativa > 0) await new Promise((r) => setTimeout(r, 1_200 * tentativa));
    try {
      const res = await fetch(`https://pncp.gov.br/api/search/?${params.toString()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) return ((await res.json()) as { items?: ItemBusca[] }).items ?? [];
    } catch {
      // tenta de novo
    }
  }
  return [];
}

export async function GET(request: NextRequest) {
  const texto = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (texto.length < 3) return NextResponse.json({ orgaos: [] });

  const tokens = tokensOrgao(texto);
  const itens = await paginaBusca(tokens.join(" "), 1);

  const porOrgao = new Map<string, { nome: string; uf: string; municipio: string; qtd: number }>();
  for (const i of itens) {
    const nome = (i.orgao_nome ?? "").trim();
    if (!nome) continue;
    const norm = semAcento(nome);
    if (!tokens.every((t) => norm.includes(t))) continue;
    const chave = i.orgao_cnpj || norm;
    const atual = porOrgao.get(chave);
    if (atual) atual.qtd += 1;
    else porOrgao.set(chave, { nome, uf: i.uf ?? "", municipio: i.municipio_nome ?? "", qtd: 1 });
  }
  const orgaos = [...porOrgao.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  return NextResponse.json({ orgaos });
}
