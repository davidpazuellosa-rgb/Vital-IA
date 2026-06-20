import { LicitacaoProvider, Paginacao, ResultadoBusca, UniversalFilter } from "../types";
import { buscarPncp } from "./pncp-client";

const MANAUS_MUNICIPIO_NOME = "Manaus";

export const comprasManausProvider: LicitacaoProvider = {
  id: "compras-manaus",
  async buscar(filtro: UniversalFilter, paginacao: Paginacao): Promise<ResultadoBusca> {
    const resultado = await buscarPncp({ ...filtro, ufs: ["AM"] }, paginacao);
    return {
      ...resultado,
      itens: resultado.itens
        .filter((item) => item.municipio === MANAUS_MUNICIPIO_NOME)
        .map((item) => ({ ...item, plataforma: "compras-manaus" as const })),
    };
  },
};
