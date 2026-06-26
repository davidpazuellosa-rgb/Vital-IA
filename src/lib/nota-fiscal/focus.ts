import type { NotaFiscalStatus } from "./types";

// Cliente da API REST do Focus NFe (https://focusnfe.com.br).
// Em homologação use FOCUS_NFE_BASE_URL=https://homologacao.focusnfe.com.br
// Em produção:                FOCUS_NFE_BASE_URL=https://api.focusnfe.com.br
const BASE_URL = process.env.FOCUS_NFE_BASE_URL ?? "https://homologacao.focusnfe.com.br";

export type FocusResultado = {
  status: NotaFiscalStatus;
  numero: string;
  serie: string;
  motivo: string;
  danfeUrl: string;
  xmlUrl: string;
};

type FocusResposta = {
  status?: string;
  numero?: string | number;
  serie?: string | number;
  mensagem_sefaz?: string;
  caminho_danfe?: string;
  caminho_xml_nota_fiscal?: string;
  mensagem?: string;
  erros?: { mensagem?: string }[];
};

function authHeader(): string {
  const token = process.env.FOCUS_NFE_TOKEN;
  if (!token) {
    throw new Error(
      "Integração fiscal não configurada. Defina FOCUS_NFE_TOKEN no ambiente.",
    );
  }
  // Focus usa Basic Auth com o token no usuário e senha vazia.
  return "Basic " + Buffer.from(`${token}:`).toString("base64");
}

function urlAbsoluta(caminho: string | undefined): string {
  if (!caminho) return "";
  return caminho.startsWith("http") ? caminho : `${BASE_URL}${caminho}`;
}

/** Mapeia o status assíncrono do Focus para o nosso enum, ou null se desconhecido. */
function statusAssincrono(focusStatus: string): NotaFiscalStatus | null {
  switch (focusStatus) {
    case "autorizado":
      return "autorizada";
    case "cancelado":
      return "cancelada";
    case "erro_autorizacao":
    case "denegado":
      return "rejeitada";
    case "processando_autorizacao":
      return "processando";
    default:
      return null;
  }
}

function motivoDe(dados: FocusResposta): string {
  return dados.mensagem_sefaz ?? dados.erros?.[0]?.mensagem ?? dados.mensagem ?? "";
}

/**
 * Interpreta a resposta considerando o status HTTP:
 * - status reconhecido no corpo → usa-o;
 * - 2xx sem status → ainda processando;
 * - 422 ou corpo com `erros` → rejeitada (validação);
 * - 404 na consulta → rejeitada (ref inexistente no provedor);
 * - demais erros (5xx/429/rede) → lança, para o chamador permitir nova tentativa.
 */
function interpretar(
  dados: FocusResposta,
  resp: Response,
  contexto: "emissao" | "consulta",
): FocusResultado {
  const base = {
    numero: dados.numero != null ? String(dados.numero) : "",
    serie: dados.serie != null ? String(dados.serie) : "",
    motivo: motivoDe(dados),
    danfeUrl: urlAbsoluta(dados.caminho_danfe),
    xmlUrl: urlAbsoluta(dados.caminho_xml_nota_fiscal),
  };

  const conhecido = statusAssincrono(String(dados.status ?? ""));
  if (conhecido) return { status: conhecido, ...base };

  if (resp.ok) return { status: "processando", ...base };

  if (resp.status === 422 || (dados.erros?.length ?? 0) > 0) {
    return { status: "rejeitada", ...base, motivo: base.motivo || "Nota rejeitada na validação." };
  }
  if (contexto === "consulta" && resp.status === 404) {
    return { status: "rejeitada", ...base, motivo: base.motivo || "Nota não encontrada no provedor." };
  }
  throw new Error(base.motivo || `Falha na comunicação com o provedor (HTTP ${resp.status}).`);
}

/** Envia a NF-e para autorização. `ref` é a referência idempotente da nota. */
export async function emitirNFe(
  ref: string,
  payload: Record<string, unknown>,
): Promise<FocusResultado> {
  const resp = await fetch(`${BASE_URL}/v2/nfe?ref=${encodeURIComponent(ref)}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const dados = (await resp.json().catch(() => ({}))) as FocusResposta;
  return interpretar(dados, resp, "emissao");
}

/** Consulta o status atual de uma NF-e já enviada (polling). */
export async function consultarNFe(ref: string): Promise<FocusResultado> {
  const resp = await fetch(`${BASE_URL}/v2/nfe/${encodeURIComponent(ref)}`, {
    method: "GET",
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  const dados = (await resp.json().catch(() => ({}))) as FocusResposta;
  return interpretar(dados, resp, "consulta");
}
