import { LicitacaoProvider, UnifiedLicitacao, UniversalFilter } from "../types";
import { buscarPncp } from "./pncp-client";

export const pncpProvider: LicitacaoProvider = {
  id: "pncp",
  async buscar(filtro: UniversalFilter): Promise<UnifiedLicitacao[]> {
    return buscarPncp(filtro);
  },
};
