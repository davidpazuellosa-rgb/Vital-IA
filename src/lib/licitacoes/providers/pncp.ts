import { LicitacaoProvider, Paginacao, ResultadoBusca, UniversalFilter } from "../types";
import { buscarPncp } from "./pncp-client";

export const pncpProvider: LicitacaoProvider = {
  id: "pncp",
  async buscar(filtro: UniversalFilter, paginacao: Paginacao): Promise<ResultadoBusca> {
    return buscarPncp(filtro, paginacao);
  },
};
