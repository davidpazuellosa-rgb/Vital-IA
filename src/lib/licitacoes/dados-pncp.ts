import { buscarItensPncp } from "./providers/pncp-itens";
import { buscarArquivosPncp, buscarLocalEntrega, type ArquivoPncp } from "./providers/pncp-arquivos";
import type { LicitacaoItem } from "./types";

/* Dados "ao vivo" do PNCP para o perfil de uma licitação. Nada aqui lança: o PNCP é instável e a
 * página deve abrir sempre, mostrando o que tem e oferecendo "tentar novamente" no que faltou. */

export type DadosPncp = {
  itens: LicitacaoItem[];
  arquivos: ArquivoPncp[];
  /** true quando o PNCP não respondeu (os itens/arquivos vazios podem ser falha, não ausência). */
  falhou: boolean;
};

export async function carregarDadosPncp(numeroControle: string): Promise<DadosPncp> {
  const [itens, arquivos] = await Promise.all([
    buscarItensPncp(numeroControle).catch(() => null),
    buscarArquivosPncp(numeroControle).catch(() => null),
  ]);
  return {
    itens: itens ?? [],
    arquivos: arquivos ?? [],
    falhou: itens === null || arquivos === null || itens.length === 0,
  };
}

/** Local de entrega lido do edital (baixa e lê PDFs: lento). Limitado a ~30 s e nunca lança. */
export async function localEntregaSegura(arquivos: ArquivoPncp[]): Promise<Awaited<ReturnType<typeof buscarLocalEntrega>>> {
  if (arquivos.length === 0) return null;
  try {
    return await Promise.race([
      buscarLocalEntrega(arquivos),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 30_000)),
    ]);
  } catch {
    return null;
  }
}
