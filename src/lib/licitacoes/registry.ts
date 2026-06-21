import {
  LicitacaoProvider,
  Paginacao,
  PlatformId,
  ResultadoBusca,
  UniversalFilter,
} from "./types";
import { pncpProvider } from "./providers/pncp";
import { comprasnetProvider } from "./providers/comprasnet";
import { ecomprasAmProvider } from "./providers/ecompras-am";
import { comprasManausProvider } from "./providers/compras-manaus";

const PROVIDERS: Record<PlatformId, LicitacaoProvider> = {
  pncp: pncpProvider,
  comprasnet: comprasnetProvider,
  "ecompras-am": ecomprasAmProvider,
  "compras-manaus": comprasManausProvider,
};

export async function buscarLicitacoes(
  filtro: UniversalFilter,
  paginacao: Paginacao,
): Promise<ResultadoBusca> {
  const plataformas = filtro.plataformas.length > 0 ? filtro.plataformas : ["pncp" as const];
  const apenasAberto = filtro.apenasAberto ?? true;

  const resultados = await Promise.all(
    plataformas.map((id) => PROVIDERS[id].buscar(filtro, paginacao)),
  );

  // Deduplica entre plataformas (a mesma licitação pode vir do PNCP e de um adaptador).
  const vistos = new Set<string>();
  const itens = resultados
    .flatMap((r) => r.itens)
    .filter((item) => {
      const chave = item.numeroControlePNCP;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

  if (apenasAberto) {
    // Encerramentos mais próximos primeiro (mais útil para enviar proposta).
    itens.sort((a, b) =>
      (a.dataEncerramentoProposta ?? "9999").localeCompare(b.dataEncerramentoProposta ?? "9999"),
    );
  } else {
    // Publicações mais recentes primeiro.
    itens.sort((a, b) => (b.dataPublicacao ?? "").localeCompare(a.dataPublicacao ?? ""));
  }

  return {
    itens,
    totalPaginas: resultados.reduce((m, r) => Math.max(m, r.totalPaginas), 0),
    totalRegistros: resultados.reduce((s, r) => s + r.totalRegistros, 0),
    incompleto: resultados.some((r) => r.incompleto),
  };
}
