import { LicitacaoProvider, PlatformId, UnifiedLicitacao, UniversalFilter } from "./types";
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

export async function buscarLicitacoes(filtro: UniversalFilter): Promise<UnifiedLicitacao[]> {
  const plataformas = filtro.plataformas.length > 0 ? filtro.plataformas : ["pncp" as const];

  const resultados = await Promise.all(
    plataformas.map((id) => PROVIDERS[id].buscar(filtro)),
  );

  return resultados.flat().sort((a, b) => {
    const dataA = a.dataPublicacao ?? "";
    const dataB = b.dataPublicacao ?? "";
    return dataB.localeCompare(dataA);
  });
}
