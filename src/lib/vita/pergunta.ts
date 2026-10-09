/* Perguntas da Vita em MÚLTIPLA ESCOLHA (como no Claude Code): a Vita não pergunta em texto solto;
 * chama `perguntar` e o chat mostra opções clicáveis. Regras:
 *  - a PRIMEIRA opção é a recomendada;
 *  - no máximo 5 opções do modelo (a interface sempre acrescenta "Outro…");
 *  - sim/não vira uma pergunta de Sim ou Não.
 * Seguro para o navegador e o servidor. */

export type OpcaoPergunta = { rotulo: string; descricao?: string };
export type PerguntaVita = {
  pergunta: string;
  tipo: "sim_nao" | "escolha";
  opcoes: OpcaoPergunta[];
  /** A primeira opção é a recomendada (mostra o selo "Recomendado"). */
  recomendada: boolean;
};

export const MAX_OPCOES = 5;
const corta = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function montarPergunta(args: Record<string, unknown>): { ok: true; pergunta: PerguntaVita } | { ok: false; erro: string } {
  const texto = corta(args.pergunta, 300);
  if (texto.length < 3) return { ok: false, erro: "Escreva a pergunta." };

  if (args.tipo === "sim_nao") {
    const naoPrimeiro = String(args.recomendada ?? "").toLowerCase().startsWith("n");
    const sim: OpcaoPergunta = { rotulo: "Sim" };
    const nao: OpcaoPergunta = { rotulo: "Não" };
    const temRecomendacao = args.recomendada != null && String(args.recomendada).trim() !== "";
    return { ok: true, pergunta: { pergunta: texto, tipo: "sim_nao", opcoes: naoPrimeiro ? [nao, sim] : [sim, nao], recomendada: temRecomendacao } };
  }

  const bruto = Array.isArray(args.opcoes) ? args.opcoes : [];
  const vistas = new Set<string>();
  const opcoes: OpcaoPergunta[] = [];
  for (const o of bruto) {
    const rotulo = corta(typeof o === "string" ? o : (o as { rotulo?: unknown })?.rotulo, 80);
    const descricao = typeof o === "string" ? "" : corta((o as { descricao?: unknown })?.descricao, 160);
    const chave = rotulo.toLowerCase();
    if (!rotulo || vistas.has(chave) || /^outr[oa]s?\b/i.test(rotulo)) continue; // "Outro" a interface já oferece
    vistas.add(chave);
    opcoes.push(descricao ? { rotulo, descricao } : { rotulo });
    if (opcoes.length === MAX_OPCOES) break;
  }
  if (opcoes.length < 2) return { ok: false, erro: "Dê de 2 a 5 opções (a primeira é a recomendada). Para sim ou não use tipo \"sim_nao\"." };
  return { ok: true, pergunta: { pergunta: texto, tipo: "escolha", opcoes, recomendada: true } };
}

/** Texto da pergunta para copiar/ler (inclui as opções). */
export function pergunta2texto(p: PerguntaVita): string {
  return `${p.pergunta}\n${p.opcoes.map((o, i) => `${i + 1}. ${o.rotulo}${o.descricao ? ` — ${o.descricao}` : ""}${i === 0 && p.recomendada ? " (Recomendado)" : ""}`).join("\n")}\n${p.opcoes.length + 1}. Outro`;
}
