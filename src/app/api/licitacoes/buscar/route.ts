import { NextRequest, NextResponse } from "next/server";
import { buscarLicitacoes } from "@/lib/licitacoes/registry";
import { UniversalFilter } from "@/lib/licitacoes/types";
import { createClient } from "@/lib/supabase/server";

const TAMANHO_PAGINA = 20;

export async function POST(request: NextRequest) {
  // Só quem está logado usa a busca (antes qualquer visitante podia usar o servidor como intermediário do PNCP).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as (UniversalFilter & { pagina?: number }) | null;
  if (!body) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  if (!body.dataInicial || !body.dataFinal) {
    return NextResponse.json(
      { error: "dataInicial e dataFinal são obrigatórios" },
      { status: 400 },
    );
  }

  const pagina = Math.max(1, Number(body.pagina) || 1);

  try {
    const { itens, totalPaginas, totalRegistros, incompleto, aviso } = await buscarLicitacoes(body, {
      pagina,
      tamanhoPagina: TAMANHO_PAGINA,
    });
    return NextResponse.json({ resultados: itens, pagina, totalPaginas, totalRegistros, incompleto, aviso });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar licitações" },
      { status: 502 },
    );
  }
}
