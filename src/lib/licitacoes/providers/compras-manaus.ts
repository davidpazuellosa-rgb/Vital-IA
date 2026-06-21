import { LicitacaoProvider, Paginacao, ResultadoBusca, UniversalFilter } from "../types";
import { buscarPncpComFiltroLocal } from "./pncp-client";

const MANAUS_MUNICIPIO_NOME = "Manaus";

export const comprasManausProvider: LicitacaoProvider = {
  id: "compras-manaus",
  async buscar(filtro: UniversalFilter, paginacao: Paginacao): Promise<ResultadoBusca> {
    const resultado = await buscarPncpComFiltroLocal(
      { ...filtro, ufs: ["AM"] },
      paginacao,
      (item) => item.municipio === MANAUS_MUNICIPIO_NOME,
    );
    return {
      ...resultado,
      itens: resultado.itens.map((item) => ({ ...item, plataforma: "compras-manaus" as const })),
    };
  },
};
