import { LicitacaoProvider, Paginacao, ResultadoBusca, UniversalFilter } from "../types";
import { buscarPncpComFiltroLocal } from "./pncp-client";

export const comprasnetProvider: LicitacaoProvider = {
  id: "comprasnet",
  async buscar(filtro: UniversalFilter, paginacao: Paginacao): Promise<ResultadoBusca> {
    const resultado = await buscarPncpComFiltroLocal(filtro, paginacao, (item) => item.esfera === "F");
    return {
      ...resultado,
      itens: resultado.itens.map((item) => ({ ...item, plataforma: "comprasnet" as const })),
    };
  },
};
