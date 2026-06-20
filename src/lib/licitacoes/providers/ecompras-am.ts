import { LicitacaoProvider, UnifiedLicitacao, UniversalFilter } from "../types";
import { buscarPncp } from "./pncp-client";

export const ecomprasAmProvider: LicitacaoProvider = {
  id: "ecompras-am",
  async buscar(filtro: UniversalFilter): Promise<UnifiedLicitacao[]> {
    const itens = await buscarPncp({ ...filtro, ufs: ["AM"] });
    return itens.map((item) => ({ ...item, plataforma: "ecompras-am" as const }));
  },
};
