import { createServiceClient } from "@/lib/supabase/service";
import { LicitacaoProvider, Paginacao, PlatformId, ResultadoBusca, UnifiedLicitacao, UniversalFilter } from "../types";
import { tokensOrgao } from "./pncp-client";

type LinhaOrigem = {
  numero_controle_pncp: string;
  titulo: string;
  descricao: string;
  orgao: string;
  esfera: string;
  uf: string;
  municipio: string;
  modalidade: string;
  situacao: string;
  valor_estimado: number | string | null;
  data_publicacao: string | null;
  data_abertura_proposta: string | null;
  data_encerramento_proposta: string | null;
  link_origem: string | null;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Remove caracteres que têm significado nos filtros do PostgREST/ilike. */
const seguro = (s: string) => s.replace(/[%_,()\\*]/g, " ").trim();

function mapLinha(l: LinhaOrigem, plataforma: PlatformId): UnifiedLicitacao {
  return {
    id: l.numero_controle_pncp,
    plataforma,
    numeroControlePNCP: l.numero_controle_pncp,
    titulo: l.titulo,
    descricao: l.descricao,
    orgao: l.orgao,
    esfera: l.esfera,
    uf: l.uf,
    municipio: l.municipio,
    modalidade: l.modalidade,
    situacao: l.situacao,
    valorEstimado: l.valor_estimado == null ? null : Number(l.valor_estimado),
    dataPublicacao: l.data_publicacao,
    dataAberturaProposta: l.data_abertura_proposta,
    dataEncerramentoProposta: l.data_encerramento_proposta,
    linkOrigem: l.link_origem,
  };
}

/**
 * Provider de um sistema de origem (Licitar Digital, BLL, Licitanet…): lê o índice próprio
 * (tabela licitacoes_origem), preenchido pela rotina scripts/indexar-origem.mjs — o PNCP
 * não filtra por sistema de origem. Os sistemas são os de origens.json.
 */
export function criarProviderOrigem(origem: PlatformId): LicitacaoProvider {
  return {
  id: origem,
  async buscar(filtro: UniversalFilter, paginacao: Paginacao): Promise<ResultadoBusca> {
    const supabase = createServiceClient();
    const apenasAberto = filtro.apenasAberto ?? true;

    let q = supabase.from("licitacoes_origem").select("*", { count: "exact" }).eq("origem", origem);
    if (apenasAberto) {
      q = q.or(`data_encerramento_proposta.gte.${new Date().toISOString()},data_encerramento_proposta.is.null`);
    } else {
      q = q.gte("data_publicacao", `${filtro.dataInicial}T00:00:00`).lte("data_publicacao", `${filtro.dataFinal}T23:59:59`);
    }
    // Palavras da busca (sem acento, todas precisam aparecer).
    for (const palavra of semAcento(filtro.keyword ?? "").split(/\s+/).map(seguro).filter(Boolean)) {
      q = q.ilike("busca", `%${palavra}%`);
    }
    if (filtro.orgao?.trim()) {
      for (const token of tokensOrgao(filtro.orgao).map(seguro).filter(Boolean)) q = q.ilike("orgao_busca", `%${token}%`);
    }
    if (filtro.ufs?.length) q = q.in("uf", filtro.ufs);
    if (filtro.modalidades?.length) q = q.in("modalidade_id", filtro.modalidades);
    if (filtro.valorMin != null) q = q.gte("valor_estimado", filtro.valorMin);
    if (filtro.valorMax != null) q = q.lte("valor_estimado", filtro.valorMax);

    const de = (paginacao.pagina - 1) * paginacao.tamanhoPagina;
    const { data, count, error } = await q
      .order("data_publicacao", { ascending: false, nullsFirst: false })
      .range(de, de + paginacao.tamanhoPagina - 1);
    if (error) return { itens: [], totalPaginas: 0, totalRegistros: 0, incompleto: true };

    const total = count ?? data?.length ?? 0;
    return {
      itens: ((data ?? []) as LinhaOrigem[]).map((l) => mapLinha(l, origem)),
      totalRegistros: total,
      totalPaginas: Math.ceil(total / paginacao.tamanhoPagina),
    };
  },
  };
}
