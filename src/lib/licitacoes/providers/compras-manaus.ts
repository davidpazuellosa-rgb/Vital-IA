import { LicitacaoProvider, UnifiedLicitacao, UniversalFilter } from "../types";
import { buscarPncp } from "./pncp-client";

const MANAUS_MUNICIPIO_NOME = "Manaus";

export const comprasManausProvider: LicitacaoProvider = {
  id: "compras-manaus",
  async buscar(filtro: UniversalFilter): Promise<UnifiedLicitacao[]> {
    const itens = await buscarPncp({ ...filtro, ufs: ["AM"] });
    return itens
      .filter((item) => item.municipio === MANAUS_MUNICIPIO_NOME)
      .map((item) => ({ ...item, plataforma: "compras-manaus" as const }));
  },
};
