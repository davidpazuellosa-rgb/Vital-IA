#!/usr/bin/env node
/**
 * Indexa as licitações ABERTAS do PNCP cujo sistema de origem (linkSistemaOrigem) é um dos
 * listados em src/lib/licitacoes/origens.json (ex.: Licitar Digital).
 *
 * O PNCP não tem filtro por sistema de origem e só entrega 50 licitações por página
 * (~33 mil abertas = ~660 páginas), então a varredura roda em segundo plano na VPS
 * (cron, 2x ao dia) e a busca do app lê o resultado da tabela licitacoes_origem.
 *
 * Variáveis: SUPABASE_SERVICE_ROLE_KEY e REST_URL (ex.: http://rest:3000) ou
 * NEXT_PUBLIC_SUPABASE_URL (usa <url>/rest/v1).
 * Uso: node scripts/indexar-origem.mjs [--max-paginas=N]
 */
import { readFileSync } from "node:fs";

const ORIGENS = JSON.parse(readFileSync(new URL("../src/lib/licitacoes/origens.json", import.meta.url), "utf8"));
const REST = (process.env.REST_URL || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`).replace(/\/+$/, "");
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!CHAVE) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const PNCP = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
const argMax = process.argv.find((a) => a.startsWith("--max-paginas="));
const MAX_PAGINAS = argMax ? Number(argMax.split("=")[1]) : Infinity;
const PAUSA_MS = 300; // gentileza com o PNCP (ele derruba conexões em rajada)
const PARALELO = Number(process.env.INDEXAR_PARALELO || 3); // páginas buscadas ao mesmo tempo

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const vazioParaNulo = (v) => (typeof v === "string" && v.trim() ? v : null);

function horizonte() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

async function pncp(pagina) {
  const url = `${PNCP}?dataFinal=${horizonte()}&pagina=${pagina}&tamanhoPagina=50`;
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": UA }, signal: AbortSignal.timeout(45_000) });
      if (res.status === 204) return { data: [], totalPaginas: 0 };
      if (res.ok) return await res.json();
    } catch {
      /* conexão derrubada / timeout → tenta de novo */
    }
    await dormir(2_000 * tentativa);
  }
  return null;
}

function origemDe(link) {
  if (!link) return null;
  let host;
  try {
    host = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  return ORIGENS.find((o) => o.hosts.some((h) => host === h || host.endsWith(`.${h}`)))?.id ?? null;
}

function linha(item, origem) {
  const descricao = item.objetoCompra ?? "";
  const orgao = item.orgaoEntidade?.razaoSocial ?? "";
  const municipio = item.unidadeOrgao?.municipioNome ?? "";
  return {
    numero_controle_pncp: item.numeroControlePNCP,
    origem,
    titulo: descricao.slice(0, 140),
    descricao,
    orgao,
    orgao_cnpj: item.orgaoEntidade?.cnpj ?? "",
    esfera: item.orgaoEntidade?.esferaId ?? "",
    uf: item.unidadeOrgao?.ufSigla ?? "",
    municipio,
    modalidade: item.modalidadeNome ?? "",
    modalidade_id: item.modalidadeId ?? null,
    situacao: item.situacaoCompraNome ?? "",
    valor_estimado: item.valorTotalEstimado ?? null,
    data_publicacao: vazioParaNulo(item.dataPublicacaoPncp),
    data_abertura_proposta: vazioParaNulo(item.dataAberturaProposta),
    data_encerramento_proposta: vazioParaNulo(item.dataEncerramentoProposta),
    link_origem: vazioParaNulo(item.linkSistemaOrigem),
    busca: semAcento(`${descricao} ${item.informacaoComplementar ?? ""} ${orgao} ${municipio}`),
    orgao_busca: semAcento(orgao),
    atualizado_em: new Date().toISOString(),
  };
}

async function gravar(linhas) {
  if (!linhas.length) return;
  const res = await fetch(`${REST}/licitacoes_origem?on_conflict=numero_controle_pncp`, {
    method: "POST",
    headers: {
      apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(linhas),
  });
  if (!res.ok) throw new Error(`Falha ao gravar no banco (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

async function limparEncerradas() {
  const limite = new Date(Date.now() - 3 * 86_400_000).toISOString();
  await fetch(`${REST}/licitacoes_origem?data_encerramento_proposta=lt.${encodeURIComponent(limite)}`, {
    method: "DELETE",
    headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, Prefer: "return=minimal" },
  });
}

const inicio = Date.now();
const primeira = await pncp(1);
if (!primeira) {
  console.error("[indexar] PNCP indisponível; nada foi alterado.");
  process.exit(1);
}
const totalPaginas = Math.min(primeira.totalPaginas ?? 1, MAX_PAGINAS);
const porOrigem = {};
const vistos = new Set();
let pendentes = [];
let falhas = 0;
let lidas = 0;

for (let inicioLote = 1; inicioLote <= totalPaginas; inicioLote += PARALELO) {
  const numeros = Array.from({ length: Math.min(PARALELO, totalPaginas - inicioLote + 1) }, (_, i) => inicioLote + i);
  const lote = await Promise.all(numeros.map((n) => (n === 1 ? primeira : pncp(n))));
  for (const dados of lote) {
    if (!dados) { falhas++; continue; }
    lidas++;
    for (const item of dados.data ?? []) {
      const origem = origemDe(item.linkSistemaOrigem);
      if (!origem || vistos.has(item.numeroControlePNCP)) continue;
      vistos.add(item.numeroControlePNCP);
      porOrigem[origem] = (porOrigem[origem] ?? 0) + 1;
      pendentes.push(linha(item, origem));
    }
  }
  if (pendentes.length >= 100) { await gravar(pendentes); pendentes = []; }
  const feitas = numeros[numeros.length - 1];
  if (Math.floor(feitas / 50) > Math.floor((feitas - numeros.length) / 50)) {
    console.log(`[indexar] ${feitas}/${totalPaginas} páginas, ${vistos.size} encontradas, ${falhas} falhas`);
  }
  await dormir(PAUSA_MS);
}
await gravar(pendentes);
// Só limpa as encerradas se a varredura foi (quase) completa.
if (MAX_PAGINAS === Infinity && falhas <= totalPaginas * 0.05) await limparEncerradas();

const min = ((Date.now() - inicio) / 60_000).toFixed(1);
console.log(`[indexar] concluído em ${min} min: ${lidas}/${totalPaginas} páginas lidas, ${falhas} falhas, encontradas`, JSON.stringify(porOrigem));
