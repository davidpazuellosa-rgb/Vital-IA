import { extractText, getDocumentProxy } from "unpdf";

/** Converte "DD/MM/AAAA" (ou com "-"/".") para ISO "AAAA-MM-DD"; null se inválida. */
function brParaIso(dia: string, mes: string, ano: string): string | null {
  const d = Number(dia);
  const m = Number(mes);
  let a = Number(ano);
  if (ano.length === 2) a = 2000 + a;
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 2000 || a > 2100) return null;
  const iso = `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  // valida data real (ex.: 31/02 não existe)
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime()) || dt.getDate() !== d) return null;
  return iso;
}

const RE_DATA = /(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4})/g;
const RE_VALIDADE = /(v[áa]lid[ao]\s*(?:at[ée]|:)?|validade|vencimento|vence|efic[áa]cia|expira(?:[çc][ãa]o)?)/i;

export type DatasExtraidas = {
  dataValidade: string | null;
  dataEmissao: string | null;
};

/**
 * Extrai datas de validade/emissão do texto de um PDF de certidão.
 * Heurística: prioriza a data logo após uma palavra-chave de validade;
 * caso não encontre, usa a data futura mais distante como provável validade.
 * PDFs escaneados (sem texto) retornam null — o usuário informa manualmente.
 */
export async function extrairDatasDoPdf(buffer: ArrayBuffer): Promise<DatasExtraidas> {
  let texto = "";
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    texto = Array.isArray(text) ? text.join("\n") : text;
  } catch {
    return { dataValidade: null, dataEmissao: null };
  }

  if (!texto.trim()) return { dataValidade: null, dataEmissao: null };

  type Achado = { iso: string; index: number };
  const datas: Achado[] = [];
  for (const m of texto.matchAll(RE_DATA)) {
    const iso = brParaIso(m[1], m[2], m[3]);
    if (iso) datas.push({ iso, index: m.index ?? 0 });
  }
  if (datas.length === 0) return { dataValidade: null, dataEmissao: null };

  // 1) Data imediatamente após uma palavra-chave de validade
  let validade: string | null = null;
  const kw = RE_VALIDADE.exec(texto);
  if (kw) {
    const apos = texto.slice(kw.index);
    const m = RE_DATA.exec(apos);
    RE_DATA.lastIndex = 0;
    if (m) validade = brParaIso(m[1], m[2], m[3]);
  }

  // 2) Fallback: a data futura mais distante (validade costuma ser a maior)
  if (!validade) {
    const ordenadas = [...datas].sort((a, b) => b.iso.localeCompare(a.iso));
    validade = ordenadas[0]?.iso ?? null;
  }

  // Emissão: a menor data encontrada (provável data de expedição)
  const emissao = [...datas].sort((a, b) => a.iso.localeCompare(b.iso))[0]?.iso ?? null;

  return {
    dataValidade: validade,
    dataEmissao: emissao && emissao !== validade ? emissao : null,
  };
}
