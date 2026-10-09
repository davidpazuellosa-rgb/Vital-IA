import {
  LicitacaoProvider,
  Paginacao,
  PlatformId,
  ResultadoBusca,
  UniversalFilter,
} from "./types";
import { pncpProvider } from "./providers/pncp";
import { buscarLicitacaoPorNumeroControle, parseNumeroControle } from "./providers/pncp-itens";
import { comprasnetProvider } from "./providers/comprasnet";
import { ecomprasAmProvider } from "./providers/ecompras-am";
import { comprasManausProvider } from "./providers/compras-manaus";
import { licitarDigitalProvider } from "./providers/licitar-digital";

const PROVIDERS: Record<PlatformId, LicitacaoProvider> = {
  pncp: pncpProvider,
  comprasnet: comprasnetProvider,
  "ecompras-am": ecomprasAmProvider,
  "compras-manaus": comprasManausProvider,
  "licitar-digital": licitarDigitalProvider,
};

export async function buscarLicitacoes(
  filtro: UniversalFilter,
  paginacao: Paginacao,
): Promise<ResultadoBusca> {
  // Busca direta por número de controle PNCP (ex.: "04407029000143-1-000043/2026"):
  // vai direto no registro exato, ignorando plataformas, datas e modalidades.
  const numeroControle = filtro.keyword?.trim();
  if (numeroControle && parseNumeroControle(numeroControle)) {
    return buscarLicitacaoPorNumeroControle(numeroControle);
  }

  const plataformas = filtro.plataformas.length > 0 ? filtro.plataformas : ["pncp" as const];

  const resultados = await Promise.all(
    plataformas.map((id) => PROVIDERS[id].buscar(filtro, paginacao)),
  );

  // Deduplica entre plataformas (a mesma licitação pode vir do PNCP e de um adaptador).
  const vistos = new Set<string>();
  const itens = resultados
    .flatMap((r) => r.itens)
    .filter((item) => {
      const chave = item.numeroControlePNCP;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

  // Sem palavra-chave: mais recente publicada primeiro (cada provedor já devolve
  // nessa ordem; o sort só unifica ao mesclar plataformas). Com palavra-chave a
  // ordem é a de relevância da busca textual do PNCP — reordenar por data
  // jogaria resultados fracos para o topo.
  if (!filtro.keyword?.trim()) {
    itens.sort((a, b) => (b.dataPublicacao ?? "").localeCompare(a.dataPublicacao ?? ""));
  }

  return {
    itens,
    totalPaginas: resultados.reduce((m, r) => Math.max(m, r.totalPaginas), 0),
    totalRegistros: resultados.reduce((s, r) => s + r.totalRegistros, 0),
    incompleto: resultados.some((r) => r.incompleto),
  };
}
