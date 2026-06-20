import { LicitacaoProvider, UnifiedLicitacao, UniversalFilter } from "../types";
import { buscarPncp } from "./pncp-client";

export const comprasnetProvider: LicitacaoProvider = {
  id: "comprasnet",
  async buscar(filtro: UniversalFilter): Promise<UnifiedLicitacao[]> {
    const itens = await buscarPncp(filtro);
    return itens
      .filter((item) => item.esfera === "F")
      .map((item) => ({ ...item, plataforma: "comprasnet" as const }));
  },
};
