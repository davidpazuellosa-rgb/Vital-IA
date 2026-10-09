import { detectarPlataforma } from "../plataforma-origem";
import { LicitacaoProvider, Paginacao, PlatformId, ResultadoBusca, UnifiedLicitacao, UniversalFilter, PLATAFORMAS } from "../types";
import { buscarPncpComFiltroLocal, varrerAbertasPorUf } from "./pncp-client";

/**
 * Provider de um sistema de origem (Licitar Digital, BLL, Licitanet…). O PNCP não filtra por
 * sistema de origem, então a busca é feita AO VIVO e filtrada pelo endereço de origem de cada
 * licitação — nada é copiado para o banco; só o que a pessoa salvar.
 *  - com palavra-chave/órgão: busca textual do PNCP e filtra o que veio;
 *  - só com estado(s) + "em aberto": varre as abertas daquele(s) estado(s) e filtra.
 * Sem nenhum desses recortes o universo é grande demais (~33 mil), então devolve um aviso.
 */
export function criarProviderOrigem(origem: PlatformId): LicitacaoProvider {
  const nome = PLATAFORMAS.find((p) => p.id === origem)?.nome ?? origem;
  const eDaOrigem = (item: UnifiedLicitacao) => detectarPlataforma(item.linkOrigem)?.id === origem;

  return {
    id: origem,
    async buscar(filtro: UniversalFilter, paginacao: Paginacao): Promise<ResultadoBusca> {
      const temTexto = Boolean(filtro.keyword?.trim() || filtro.orgao?.trim());
      const apenasAberto = filtro.apenasAberto ?? true;

      if (!temTexto && !(apenasAberto && filtro.ufs?.length)) {
        return {
          itens: [], totalPaginas: 0, totalRegistros: 0,
          aviso: `Para buscar no ${nome}, digite uma palavra-chave ou escolha o(s) estado(s) com “somente em aberto” marcado. O PNCP não permite listar por sistema, e cada busca é feita na hora.`,
        };
      }

      const marcar = (itens: UnifiedLicitacao[]) => itens.map((i) => ({ ...i, plataforma: origem }));

      if (temTexto) {
        const r = await buscarPncpComFiltroLocal(filtro, paginacao, eDaOrigem);
        return { ...r, itens: marcar(r.itens) };
      }

      const { itens, incompleto, limitado } = await varrerAbertasPorUf(filtro, eDaOrigem);
      const inicio = (paginacao.pagina - 1) * paginacao.tamanhoPagina;
      return {
        itens: marcar(itens.slice(inicio, inicio + paginacao.tamanhoPagina)),
        totalRegistros: itens.length,
        totalPaginas: Math.ceil(itens.length / paginacao.tamanhoPagina),
        incompleto,
        aviso: limitado ? "Alguns estados têm mais licitações abertas do que o limite da busca ao vivo; para cobrir tudo, acrescente uma palavra-chave ou uma modalidade." : undefined,
      };
    },
  };
}
