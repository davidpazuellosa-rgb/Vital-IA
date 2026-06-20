import { NextRequest, NextResponse } from "next/server";
import { buscarLicitacoes } from "@/lib/licitacoes/registry";
import { UniversalFilter } from "@/lib/licitacoes/types";

export async function POST(request: NextRequest) {
  const filtro = (await request.json()) as UniversalFilter;

  if (!filtro.dataInicial || !filtro.dataFinal) {
    return NextResponse.json(
      { error: "dataInicial e dataFinal são obrigatórios" },
      { status: 400 },
    );
  }

  try {
    const resultados = await buscarLicitacoes(filtro);
    return NextResponse.json({ resultados });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar licitações" },
      { status: 502 },
    );
  }
}
