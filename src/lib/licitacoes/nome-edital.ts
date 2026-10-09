/* Nome do ZIP/pasta do edital: "Cidade-objeto resumido".
 * Ex.: "Sete Lagoas-Registro preços relógio ponto biométrico". Função pura. */

const PALAVRAS_VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "para", "p", "por", "e", "a", "o", "as", "os", "em", "com", "no", "na", "nos", "nas", "ao", "aos",
  "visando", "eventual", "futura", "futuras", "objeto", "destinado", "destinada", "destinados", "conforme", "atender", "atendimento",
  "especializada", "especializadas", "empresa", "empresas", "contratacao", "contratação",
  // enchimento comum no começo dos objetos
  "aquisição", "aquisicao", "aq", "registro", "preços", "precos", "fornecimento", "prestação", "prestacao", "serviço", "servico",
]);

const MAX_OBJETO = 44;
const MAX_PALAVRAS = 6;

const semCaracteresProibidos = (s: string) => s.replace(/[\\/:*?"<>|;,()\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();

/** Primeira letra maiúscula e o resto minúsculo quando o texto veio TODO EM CAIXA ALTA. */
function frase(s: string): string {
  const letras = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const caixaAlta = letras.length > 3 && letras === letras.toUpperCase();
  const t = caixaAlta ? s.toLowerCase() : s;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function titulo(s: string): string {
  return s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());
}

export function resumirObjeto(objeto: string): string {
  const palavras = semCaracteresProibidos(objeto)
    .split(" ")
    .filter((p) => p && !PALAVRAS_VAZIAS.has(p.toLowerCase().replace(/[^\p{L}\d]/gu, "")));
  let saida = "";
  for (const p of palavras.slice(0, MAX_PALAVRAS)) {
    if ((saida + " " + p).trim().length > MAX_OBJETO) break;
    saida = (saida + " " + p).trim();
  }
  return frase(saida);
}

export function nomeEdital(
  d: { municipio?: string | null; uf?: string | null; titulo?: string | null; orgao?: string | null },
  numeroControle: string,
): string {
  const cidadeBruta = (d.municipio?.trim() || (d.orgao ?? "").replace(/^(munic[ií]pio|prefeitura)( municipal)? de /i, "")).trim();
  const cidade = cidadeBruta ? titulo(semCaracteresProibidos(cidadeBruta)) : "";
  const objeto = d.titulo ? resumirObjeto(d.titulo) : "";
  const nome = [cidade, objeto].filter(Boolean).join("-");
  return nome || `edital-${numeroControle.replace(/[^\w]/g, "_")}`;
}

/** Cabeçalho Content-Disposition com o nome UTF-8 (acentos) e um plano B só-ASCII. */
export function contentDispositionZip(nome: string): string {
  const base = nome.replace(/\.zip$/i, "");
  const ascii = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${ascii}.zip"; filename*=UTF-8''${encodeURIComponent(base)}.zip`;
}
