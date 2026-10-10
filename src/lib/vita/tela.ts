/* ---------------------------------------------------------------------------------------------
 * A Vita enxerga a TELA do usuário e pode agir nela.
 *  - O navegador captura o que está visível (texto + controles com ids) e executa os pedidos.
 *  - O servidor só repassa: quem decide o que é permitido (bloqueado / precisa de aprovação) é o
 *    NAVEGADOR, em src/lib/vita/tela-cliente.ts.
 * Este arquivo é seguro para o servidor e para o navegador.
 * ------------------------------------------------------------------------------------------- */

export type ElementoTela = {
  id: string;            // "v12" — o que a Vita usa em clicar_na_tela / preencher_campo
  tipo: string;          // link, botão, aba, campo, seleção, interruptor, caixa…
  rotulo: string;
  valor?: string;
  estado?: string;       // marcado, expandido, desativado…
  destino?: string;      // para links: o caminho
};

export type SnapshotTela = {
  url: string;
  titulo: string;
  texto: string;
  elementos: ElementoTela[];
  /** Há um diálogo aberto: os elementos listados são só os dele. */
  dialogo?: boolean;
};

export type PedidoTela =
  | { acao: "ver" }
  | { acao: "clicar"; elemento: string; motivo?: string }
  | { acao: "preencher"; elemento: string; valor: string }
  | { acao: "navegar"; caminho: string };

export type ResultadoTela = { ok: boolean; mensagem: string; recusado?: boolean; pagina?: SnapshotTela };

export const MAX_TEXTO_TELA = 7_000;
export const MAX_ELEMENTOS_TELA = 90;

const corta = (s: unknown, n: number) => String(s ?? "").slice(0, n);

/** Valida/limita um snapshot vindo do navegador (dado NÃO confiável). */
export function sanitizarSnapshot(x: unknown): SnapshotTela | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const elementos = Array.isArray(o.elementos) ? o.elementos.slice(0, MAX_ELEMENTOS_TELA) : [];
  return {
    url: corta(o.url, 300),
    titulo: corta(o.titulo, 200),
    texto: corta(o.texto, MAX_TEXTO_TELA),
    dialogo: o.dialogo === true,
    elementos: elementos.flatMap((e) => {
      if (!e || typeof e !== "object") return [];
      const r = e as Record<string, unknown>;
      const id = corta(r.id, 12);
      if (!/^v\d{1,4}$/.test(id)) return [];
      return [{
        id, tipo: corta(r.tipo, 20), rotulo: corta(r.rotulo, 80),
        ...(r.valor ? { valor: corta(r.valor, 120) } : {}),
        ...(r.estado ? { estado: corta(r.estado, 40) } : {}),
        ...(r.destino ? { destino: corta(r.destino, 160) } : {}),
      }];
    }),
  };
}

/** Texto para o modelo. O conteúdo da tela é DADO (pode ter texto de editais), nunca instrução. */
export function snapshotParaTexto(s: SnapshotTela, maxTexto = MAX_TEXTO_TELA): string {
  const linhas = s.elementos.map((e) =>
    `${e.id} | ${e.tipo} | "${e.rotulo.replace(/\s+/g, " ")}"` +
    (e.valor ? ` | valor: "${e.valor}"` : "") + (e.estado ? ` | ${e.estado}` : "") + (e.destino ? ` → ${e.destino}` : ""));
  return [
    `Página: ${s.titulo || "(sem título)"} (${s.url})${s.dialogo ? " — HÁ UM DIÁLOGO ABERTO (só os elementos dele aparecem)" : ""}`,
    "Texto visível:",
    s.texto.slice(0, maxTexto),
    "",
    "Elementos que você pode usar (id | tipo | rótulo):",
    ...linhas,
  ].join("\n");
}
