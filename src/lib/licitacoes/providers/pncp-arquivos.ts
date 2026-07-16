import { extractText, getDocumentProxy } from "unpdf";
import { parseNumeroControle } from "./pncp-itens";

const PNCP_API = "https://pncp.gov.br/api/pncp/v1";

export type ArquivoPncp = {
  sequencial: number;
  titulo: string;
  tipo: string;
  url: string;
  dataPublicacao: string | null;
};

export type ArquivoEditalLido = ArquivoPncp & {
  status: "lido" | "sem_texto" | "nao_suportado" | "erro";
  metodoLeitura: "texto" | "ocr" | null;
  paginas: number;
  caracteres: number;
  texto: string;
};

type ArquivoPncpBruto = {
  sequencialDocumento: number;
  titulo: string | null;
  tipoDocumentoNome: string | null;
  url: string;
  dataPublicacaoPncp: string | null;
};

export async function buscarArquivosPncp(numeroControlePNCP: string): Promise<ArquivoPncp[]> {
  const ref = parseNumeroControle(numeroControlePNCP);
  if (!ref) return [];

  const url = `${PNCP_API}/orgaos/${ref.cnpj}/compras/${ref.ano}/${ref.sequencial}/arquivos`;
  const resposta = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!resposta.ok) return [];

  const arquivos = (await resposta.json()) as ArquivoPncpBruto[];
  return arquivos.map((arquivo) => ({
    sequencial: arquivo.sequencialDocumento,
    titulo: arquivo.titulo?.trim() || `Documento ${arquivo.sequencialDocumento}`,
    tipo: arquivo.tipoDocumentoNome?.trim() || "Documento",
    url: arquivo.url,
    dataPublicacao: arquivo.dataPublicacaoPncp,
  }));
}

export async function lerArquivoEdital(
  arquivo: ArquivoPncp,
  opcoes?: { ocr?: (buffer: Uint8Array, totalPaginas: number, titulo: string) => Promise<string> },
): Promise<ArquivoEditalLido> {
  try {
    const resposta = await fetch(arquivo.url, {
      headers: { Accept: "application/pdf,application/octet-stream,*/*" },
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    if (!resposta.ok) return resultadoVazio(arquivo, "erro");

    const contentType = resposta.headers.get("content-type")?.toLowerCase() ?? "";
    const nomePdf = arquivo.titulo.toLowerCase().endsWith(".pdf");
    if (!contentType.includes("pdf") && !contentType.includes("octet-stream") && !nomePdf) {
      return resultadoVazio(arquivo, "nao_suportado");
    }

    const buffer = new Uint8Array(await resposta.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text, totalPages } = await extractText(pdf, { mergePages: false });
    let texto = text.map((pagina, indice) => `[Página ${indice + 1}]\n${pagina}`).join("\n\n").trim();
    let metodoLeitura: ArquivoEditalLido["metodoLeitura"] = texto ? "texto" : null;
    if (!texto && opcoes?.ocr) {
      try {
        texto = (await opcoes.ocr(buffer, totalPages, arquivo.titulo)).trim();
        if (texto) metodoLeitura = "ocr";
      } catch (error) {
        console.error(`[OCR] Falha ao ler ${arquivo.titulo}:`, error instanceof Error ? error.message : error);
      }
    }
    return {
      ...arquivo,
      status: texto ? "lido" : "sem_texto",
      metodoLeitura,
      paginas: totalPages,
      caracteres: texto.length,
      texto,
    };
  } catch {
    return resultadoVazio(arquivo, "erro");
  }
}

function resultadoVazio(
  arquivo: ArquivoPncp,
  status: ArquivoEditalLido["status"],
): ArquivoEditalLido {
  return { ...arquivo, status, metodoLeitura: null, paginas: 0, caracteres: 0, texto: "" };
}

export type LocalEntregaEncontrado = { trecho: string; origem: string };

// Cobre as redações mais comuns nos editais/TRs — testado contra documentos
// reais do PNCP. "local de entrega" sozinho não é suficiente: muitos termos
// de referência descrevem o endereço como "os bens deverão ser entregues no
// seguinte endereço", sem usar literalmente essas palavras.
const PADRAO_LOCAL_ENTREGA =
  /(local de (?:entrega|execu[cç][aã]o))|(entreg\w*.{0,40}endere[cç]o)|(endere[cç]o.{0,40}entrega)|(local (?:de )?(?:recebimento|entrega dos bens))/i;
// Arquivos com maior chance de conter a cláusula — lidos primeiro para evitar
// baixar/ler todo o processo quando o edital ou o TR já resolvem.
const ARQUIVO_PRIORITARIO = /edital|termo de refer[êe]ncia/i;
const LIMITE_ARQUIVOS_LIDOS = 6; // teto de segurança (processos com muitos anexos)

/**
 * Procura o trecho "local de entrega/execução" nos arquivos do PNCP desta
 * contratação. O PNCP não expõe esse dado como campo estruturado — só existe
 * como texto livre dentro do edital/termo de referência. Lê os arquivos mais
 * prováveis primeiro e para assim que encontra a primeira ocorrência.
 */
export async function buscarLocalEntrega(arquivos: ArquivoPncp[]): Promise<LocalEntregaEncontrado | null> {
  const ordenados = [...arquivos]
    .sort((a, b) => {
      const pa = ARQUIVO_PRIORITARIO.test(a.tipo) || ARQUIVO_PRIORITARIO.test(a.titulo) ? 0 : 1;
      const pb = ARQUIVO_PRIORITARIO.test(b.tipo) || ARQUIVO_PRIORITARIO.test(b.titulo) ? 0 : 1;
      return pa - pb;
    })
    .slice(0, LIMITE_ARQUIVOS_LIDOS);

  for (const arquivo of ordenados) {
    const lido = await lerArquivoEdital(arquivo);
    if (lido.status !== "lido") continue;
    const texto = lido.texto.replace(/\s+/g, " ");
    const m = PADRAO_LOCAL_ENTREGA.exec(texto);
    if (!m || m.index == null) continue;
    const inicio = Math.max(0, m.index - 40);
    const fim = Math.min(texto.length, m.index + m[0].length + 280);
    return { trecho: texto.slice(inicio, fim).trim(), origem: arquivo.titulo };
  }
  return null;
}
