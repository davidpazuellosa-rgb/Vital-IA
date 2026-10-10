import { randomUUID } from "node:crypto";
import type { PedidoTela, ResultadoTela } from "./tela";

/* Ponte servidor ↔ navegador: a ferramenta pede uma ação na tela, o navegador executa (com as travas
 * de segurança dele) e responde em /api/vita/tela/[id]. O mapa fica em globalThis porque as rotas do
 * Next podem ter cópias separadas deste módulo. */

type Pendente = { userId: string; resolver: (r: ResultadoTela) => void; timer: ReturnType<typeof setTimeout> };
const g = globalThis as unknown as { __vitaTela?: Map<string, Pendente> };
const pendentes = (g.__vitaTela ??= new Map<string, Pendente>());

const ESPERA_MS = 150_000; // dá tempo de o usuário aprovar um cartão

export function pedirAoNavegador(
  userId: string,
  pedido: PedidoTela,
  enviar: (evento: Record<string, unknown>) => void,
  sinal: AbortSignal,
): Promise<ResultadoTela> {
  return new Promise((resolve) => {
    const id = randomUUID();
    const encerrar = (r: ResultadoTela) => {
      const p = pendentes.get(id);
      if (!p) return;
      clearTimeout(p.timer);
      pendentes.delete(id);
      resolve(r);
    };
    const timer = setTimeout(() => encerrar({ ok: false, mensagem: "Sem resposta da tela (o usuário pode ter saído ou não aprovou a tempo)." }), ESPERA_MS);
    pendentes.set(id, { userId, resolver: encerrar, timer });
    sinal.addEventListener("abort", () => encerrar({ ok: false, mensagem: "Cancelado pelo usuário." }), { once: true });
    enviar({ tipo: "tela", id, pedido });
  });
}

/** Chamado pela rota /api/vita/tela/[id]. Só o dono do pedido consegue responder. */
export function responderPedido(id: string, userId: string, resultado: ResultadoTela): boolean {
  const p = pendentes.get(id);
  if (!p || p.userId !== userId) return false;
  p.resolver(resultado);
  return true;
}
