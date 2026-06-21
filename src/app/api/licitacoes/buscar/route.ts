import { NextRequest, NextResponse } from "next/server";
import { buscarLicitacoes } from "@/lib/licitacoes/registry";
import { UniversalFilter } from "@/lib/licitacoes/types";

const TAMANHO_PAGINA = 20;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as UniversalFilter & { pagina?: number };

  if (!body.dataInicial || !body.dataFinal) {
    return NextResponse.json(
      { error: "dataInicial e dataFinal são obrigatórios" },
      { status: 400 },
    );
  }

  const pagina = Math.max(1, Number(body.pagina) || 1);

  try {
    const { itens, totalPaginas, totalRegistros, incompleto } = await buscarLicitacoes(body, {
      pagina,
      tamanhoPagina: TAMANHO_PAGINA,
    });
    return NextResponse.json({ resultados: itens, pagina, totalPaginas, totalRegistros, incompleto });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar licitações" },
      { status: 502 },
    );
  }
}
