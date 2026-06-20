import { LicitacaoProvider, Paginacao, ResultadoBusca, UniversalFilter } from "../types";
import { buscarPncp } from "./pncp-client";

export const comprasnetProvider: LicitacaoProvider = {
  id: "comprasnet",
  async buscar(filtro: UniversalFilter, paginacao: Paginacao): Promise<ResultadoBusca> {
    const resultado = await buscarPncp(filtro, paginacao);
    return {
      ...resultado,
      itens: resultado.itens
        .filter((item) => item.esfera === "F")
        .map((item) => ({ ...item, plataforma: "comprasnet" as const })),
    };
  },
};
