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
// (?<!in) evita casar com "invalidará" / "inválido"; \b ancora no início da palavra
const RE_VALIDADE = /(?<!in)\b(v[áa]lid[ao]\s*(?:at[ée]|:)?|validade|vencimento|vence|efic[áa]cia|vig[êe]ncia|expira(?:[çc][ãa]o)?)/i;
// quão longe da palavra-chave ainda aceitamos a data de validade
const JANELA_VALIDADE = 70;
// o que pode ligar as duas datas de um período: "15/10/2026 a 13/11/2026", "de … até …", "… - …"
const RE_LIGACAO_PERIODO = /^\s*(?:a|à|ao|at[ée]|e|-|–|—)\s*$/i;

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

  return extrairDatasDoTexto(texto);
}

/** Datas de validade/emissão a partir do TEXTO de um documento (separado do PDF para poder ser testado). */
export function extrairDatasDoTexto(texto: string): DatasExtraidas {
  if (!texto.trim()) return { dataValidade: null, dataEmissao: null };

  type Achado = { iso: string; index: number };
  const datas: Achado[] = [];
  for (const m of texto.matchAll(RE_DATA)) {
    const iso = brParaIso(m[1], m[2], m[3]);
    if (iso) datas.push({ iso, index: m.index ?? 0 });
  }
  if (datas.length === 0) return { dataValidade: null, dataEmissao: null };

  // 1) Data logo após uma palavra-chave de validade (dentro de uma janela curta)
  let validade: string | null = null;
  let inicioDoPeriodo: string | null = null;
  const kw = RE_VALIDADE.exec(texto);
  if (kw) {
    const janela = texto.slice(kw.index, kw.index + JANELA_VALIDADE);
    const encontradas = [...janela.matchAll(RE_DATA)];
    const primeira = encontradas[0];
    const segunda = encontradas[1];
    if (primeira) {
      validade = brParaIso(primeira[1], primeira[2], primeira[3]);
      // Período ("Validade: 15/10/2026 a 13/11/2026"): a primeira data é o INÍCIO; a validade é a última.
      if (segunda && validade) {
        const entre = janela.slice((primeira.index ?? 0) + primeira[0].length, segunda.index ?? 0);
        const fim = brParaIso(segunda[1], segunda[2], segunda[3]);
        if (fim && fim > validade && RE_LIGACAO_PERIODO.test(entre)) { inicioDoPeriodo = validade; validade = fim; }
      }
    }
  }

  // 2) Fallback: a data mais distante (validade costuma ser a maior do documento)
  if (!validade) {
    validade = [...datas].sort((a, b) => b.iso.localeCompare(a.iso))[0]?.iso ?? null;
  }

  // Emissão: o início do período, se houve; senão a maior data estritamente anterior à validade (ignora datas espúrias antigas)
  const emissao = inicioDoPeriodo ?? 
    datas
      .map((d) => d.iso)
      .filter((iso) => validade != null && iso < validade)
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

  return { dataValidade: validade, dataEmissao: emissao };
}
