import { linkPncp } from "@/lib/licitacoes/pncp-url";

/* ---------------------------------------------------------------------------------------------
 * Garante que TODA licitação mostrada pela Vita (tabela, lista ou texto) tenha dois links:
 *  - [Perfil]: a página da licitação no sistema;
 *  - [PNCP]: a página dela no portal do PNCP.
 * Não depende do modelo lembrar: roda sobre o texto da resposta, ao exibir e ao copiar.
 * Função pura e segura para o navegador.
 * ------------------------------------------------------------------------------------------- */

const NUMERO = /\b(\d{14}-\d{1,2}-\d{3,9}\/\d{4})\b/;

export const perfilDe = (numero: string) => `/licitacao/pncp?n=${encodeURIComponent(numero)}`;

function linksDe(numero: string, ja: { perfil: boolean; pncp: boolean }): string {
  const partes: string[] = [];
  if (!ja.perfil) partes.push(`[Perfil](${perfilDe(numero)})`);
  const portal = linkPncp(numero);
  if (!ja.pncp && portal) partes.push(`[PNCP](${portal})`);
  return partes.join(" ");
}

const temPerfil = (t: string) => /\]\(\/licitacao\//.test(t);
const temPncp = (t: string) => /\]\(https:\/\/pncp\.gov\.br\//.test(t);

const ehLinhaTabela = (l: string) => l.trim().startsWith("|");
const celulas = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const linha = (cels: string[]) => `| ${cels.join(" | ")} |`;

function enriquecerTabela(bloco: string[]): string[] {
  if (bloco.length < 3) return bloco;
  const cab = celulas(bloco[0]);
  const corpo = bloco.slice(2);
  if (!corpo.some((l) => NUMERO.test(l))) return bloco; // tabela sem licitações: não mexe

  // O modelo já fez uma coluna de link? Só completa o que falta nela.
  const idxLink = cab.findIndex((c) => /^(abrir|perfil|links?)$/i.test(c.replace(/[*_`]/g, "")));
  if (idxLink >= 0) {
    return [
      bloco[0], bloco[1],
      ...corpo.map((l) => {
        const cels = celulas(l);
        const numero = l.match(NUMERO)?.[1];
        if (!numero || cels.length <= idxLink) return l;
        const faltam = linksDe(numero, { perfil: temPerfil(cels[idxLink]), pncp: temPncp(l) });
        if (faltam) cels[idxLink] = `${cels[idxLink]} ${faltam}`.trim();
        return linha(cels);
      }),
    ];
  }

  // Sem coluna de link: cria uma, à esquerda (fica visível mesmo no painel estreito).
  return [
    linha(["Links", ...cab]),
    linha(["---", ...celulas(bloco[1])]),
    ...corpo.map((l) => {
      const numero = l.match(NUMERO)?.[1];
      return linha([numero ? linksDe(numero, { perfil: temPerfil(l), pncp: temPncp(l) }) : "", ...celulas(l)]);
    }),
  ];
}

/** Acrescenta [Perfil] e [PNCP] a cada licitação citada (identificada pelo nº de controle PNCP). */
export function comLinksDeLicitacao(texto: string): string {
  if (!NUMERO.test(texto)) return texto;
  const linhas = texto.split("\n");
  const saida: string[] = [];
  let emCodigo = false;
  for (let i = 0; i < linhas.length; ) {
    const l = linhas[i];
    if (/^\s*```/.test(l)) { emCodigo = !emCodigo; saida.push(l); i++; continue; }
    if (emCodigo) { saida.push(l); i++; continue; }
    if (ehLinhaTabela(l)) {
      const bloco: string[] = [];
      while (i < linhas.length && ehLinhaTabela(linhas[i])) bloco.push(linhas[i++]);
      saida.push(...enriquecerTabela(bloco));
      continue;
    }
    const numero = l.match(NUMERO)?.[1];
    if (numero) {
      const faltam = linksDe(numero, { perfil: temPerfil(l), pncp: temPncp(l) });
      saida.push(faltam ? `${l} · ${faltam}` : l);
    } else {
      saida.push(l);
    }
    i++;
  }
  return saida.join("\n");
}
