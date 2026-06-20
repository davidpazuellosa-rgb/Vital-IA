import { LicitacaoProvider, Paginacao, ResultadoBusca, UniversalFilter } from "../types";
import { buscarPncp } from "./pncp-client";

export const ecomprasAmProvider: LicitacaoProvider = {
  id: "ecompras-am",
  async buscar(filtro: UniversalFilter, paginacao: Paginacao): Promise<ResultadoBusca> {
    const resultado = await buscarPncp({ ...filtro, ufs: ["AM"] }, paginacao);
    return {
      ...resultado,
      itens: resultado.itens.map((item) => ({ ...item, plataforma: "ecompras-am" as const })),
    };
  },
};
