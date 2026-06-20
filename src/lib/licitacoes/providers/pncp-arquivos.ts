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

export async function lerArquivoEdital(arquivo: ArquivoPncp): Promise<ArquivoEditalLido> {
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
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const texto = (Array.isArray(text) ? text.join("\n") : text).trim();
    return {
      ...arquivo,
      status: texto ? "lido" : "sem_texto",
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
  return { ...arquivo, status, paginas: 0, caracteres: 0, texto: "" };
}
