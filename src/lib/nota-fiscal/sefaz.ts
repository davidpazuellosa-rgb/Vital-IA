import type { NotaFiscalStatus, ResultadoEmissao } from "./types";

// Engine de integração DIRETA com a SEFAZ, sem provedor pago.
//
// O Vital.IA roda na Vercel (serverless) e não pode hospedar o serviço de
// assinatura/transmissão (PHP + sped-nfe). Por isso a emissão vive num
// microserviço separado (pasta `nfe-service/`, deploy fora da Vercel) e este
// módulo é apenas o CLIENTE HTTP dele — falando servidor-a-servidor, com o
// certificado A1 guardado só no microserviço.
//
// Implementa o mesmo contrato que `focus.ts`, para que `engine.ts` possa
// alternar entre os dois motores sem o app saber qual está ativo.
//
// Env:
//   NFE_SERVICE_URL     base do microserviço (ex.: https://nfe.seu-host.app)
//   NFE_SERVICE_TOKEN   token Bearer compartilhado (autentica o app no serviço)
//   NFE_SEFAZ_AMBIENTE  "homologacao" (padrão) | "producao"

const BASE_URL = process.env.NFE_SERVICE_URL ?? "";

/** true quando o microserviço aponta para homologação (notas sem valor fiscal). */
export function ehHomologacao(): boolean {
  return (process.env.NFE_SEFAZ_AMBIENTE ?? "homologacao").toLowerCase() !== "producao";
}

function exigirConfig(): { base: string; token: string } {
  const token = process.env.NFE_SERVICE_TOKEN;
  if (!BASE_URL || !token) {
    throw new Error(
      "Integração fiscal direta não configurada. Defina NFE_SERVICE_URL e NFE_SERVICE_TOKEN no ambiente.",
    );
  }
  return { base: BASE_URL.replace(/\/$/, ""), token };
}

function authHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${token}`, ...extra };
}

type RespostaServico = Partial<ResultadoEmissao> & { erro?: string; ccePdfUrl?: string };

async function ler(resp: Response): Promise<RespostaServico> {
  return (await resp.json().catch(() => ({}))) as RespostaServico;
}

/**
 * O microserviço é a autoridade sobre o status: responde 2xx com um `status`
 * já classificado (autorizada/rejeitada/processando/cancelada) para qualquer
 * desfecho de SEFAZ, e só usa HTTP de erro para falhas de infra (retentáveis).
 */
function comoResultado(dados: RespostaServico): ResultadoEmissao {
  return {
    status: dados.status ?? "processando",
    numero: dados.numero ?? "",
    serie: dados.serie ?? "",
    motivo: dados.motivo ?? "",
    danfeUrl: dados.danfeUrl ?? "",
    xmlUrl: dados.xmlUrl ?? "",
    chave: dados.chave ?? "",
    protocolo: dados.protocolo ?? "",
    xmlBase64: dados.xmlBase64 ?? "",
    danfeBase64: dados.danfeBase64 ?? "",
  };
}

/** Envia a NF-e para autorização. `ref` é a referência idempotente da nota. */
export async function emitirNFe(
  ref: string,
  payload: Record<string, unknown>,
): Promise<ResultadoEmissao> {
  const { base, token } = exigirConfig();
  const resp = await fetch(`${base}/nfe?ref=${encodeURIComponent(ref)}`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const dados = await ler(resp);
  if (!resp.ok) {
    throw new Error(dados.erro || `Falha na comunicação com o serviço fiscal (HTTP ${resp.status}).`);
  }
  return comoResultado(dados);
}

/** Consulta o status atual de uma NF-e já enviada (polling). */
export async function consultarNFe(ref: string): Promise<ResultadoEmissao> {
  const { base, token } = exigirConfig();
  const resp = await fetch(`${base}/nfe/${encodeURIComponent(ref)}`, {
    method: "GET",
    headers: authHeaders(token),
    cache: "no-store",
  });
  const dados = await ler(resp);
  if (resp.status === 404) {
    return comoResultado({ ...dados, status: "rejeitada", motivo: dados.motivo || "Nota não encontrada no serviço fiscal." });
  }
  if (!resp.ok) {
    throw new Error(dados.erro || `Falha na comunicação com o serviço fiscal (HTTP ${resp.status}).`);
  }
  return comoResultado(dados);
}

/** Baixa um arquivo (DANFE/XML) do microserviço, autenticado. */
export async function baixarArquivo(
  url: string,
): Promise<{ conteudo: ArrayBuffer; contentType: string }> {
  const { token } = exigirConfig();
  const resp = await fetch(url, { headers: authHeaders(token), cache: "no-store" });
  if (!resp.ok) {
    throw new Error(`Falha ao baixar arquivo do serviço fiscal (HTTP ${resp.status}).`);
  }
  return {
    conteudo: await resp.arrayBuffer(),
    contentType: resp.headers.get("content-type") ?? "application/octet-stream",
  };
}

/**
 * Cancela uma NF-e autorizada. Retorna "cancelada" quando a SEFAZ confirma na
 * hora, "processando" quando é assíncrono. Lança em rejeição/erro (a nota deve
 * permanecer autorizada).
 */
export async function cancelarNFe(
  ref: string,
  justificativa: string,
): Promise<NotaFiscalStatus> {
  const { base, token } = exigirConfig();
  const resp = await fetch(`${base}/nfe/${encodeURIComponent(ref)}`, {
    method: "DELETE",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ justificativa }),
    cache: "no-store",
  });
  const dados = await ler(resp);
  if (!resp.ok) {
    throw new Error(dados.erro || `Falha ao cancelar a nota (HTTP ${resp.status}).`);
  }
  if (dados.status === "cancelada") return "cancelada";
  if (!dados.status || dados.status === "processando") return "processando";
  throw new Error(dados.motivo || "Cancelamento não confirmado pela SEFAZ.");
}

/** Registra uma carta de correção (CC-e). Retorna o link do PDF da CC-e. */
export async function cartaCorrecaoNFe(
  ref: string,
  correcao: string,
): Promise<{ ccePdfUrl: string }> {
  const { base, token } = exigirConfig();
  const resp = await fetch(`${base}/nfe/${encodeURIComponent(ref)}/carta-correcao`, {
    method: "POST",
    headers: authHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({ correcao }),
    cache: "no-store",
  });
  const dados = await ler(resp);
  if (!resp.ok) {
    throw new Error(dados.erro || `Falha na carta de correção (HTTP ${resp.status}).`);
  }
  return { ccePdfUrl: dados.ccePdfUrl ?? "" };
}
