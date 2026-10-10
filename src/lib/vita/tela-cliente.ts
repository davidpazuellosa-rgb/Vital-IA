/* ---------------------------------------------------------------------------------------------
 * Lado do NAVEGADOR da "tela da Vita": captura o que o usuário vê e executa os pedidos da Vita
 * (clicar, preencher, navegar). TODAS as travas de segurança vivem aqui, no navegador do usuário:
 *   - BLOQUEADO: emitir/cancelar nota fiscal, assinar, sair, campos de senha/token/chave, upload de arquivo;
 *   - APROVAÇÃO: qualquer clique que possa alterar dados (o usuário vê um cartão e decide);
 *   - LIVRE: links internos, abas, abrir/fechar menus e diálogos, filtros e pesquisa;
 *   - a própria Vita (painel) e avisos nunca são lidos nem clicados.
 * Só roda no navegador.
 * ------------------------------------------------------------------------------------------- */

import {
  MAX_ELEMENTOS_TELA, MAX_TEXTO_TELA,
  type ElementoTela, type PedidoTela, type ResultadoTela, type SnapshotTela,
} from "./tela";

const BLOQUEADO = /emitir|cancelar\s+(a\s+)?nota|carta\s+de\s+corre|sefaz|marcar\s+como\s+enviada|desfazer\s+envio|assinar|assinatura|^sair\b|\blogout\b|excluir\s+conta|pagar|comprar/i;
const SEGREDO = /token|senha|password|api[\s_-]?key|chave|secret/i;
const LIVRE = /^(pesquisar|buscar|filtros?|colunas|cards|tabela|abrir|ver\b|fechar|voltar|anterior|pr[óo]xima|expandir|recolher|mostrar|ocultar|limpar\s+pesquisa|memórias|ferramentas|avaliações|oportunidade$|proposta pronta$|proposta enviada$|licitação vencida$|licitação perdida$)/i;

const SELETOR =
  'a[href], button, [role="tab"], [role="switch"], [role="checkbox"], [role="combobox"], [role="option"], [role="menuitem"], summary, input:not([type="hidden"]), textarea, select';

const dentroDaVita = (el: Element) => Boolean(el.closest('aside[aria-label^="Vita"], [data-sonner-toaster], [data-vita-ignorar]'));

function visivel(el: Element): boolean {
  const r = el.getClientRects();
  if (!r.length) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && cs.display !== "none";
}

const limpar = (s: string | null | undefined, n = 80) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function rotuloDe(el: Element): string {
  const e = el as HTMLElement & { labels?: NodeListOf<HTMLLabelElement>; placeholder?: string; name?: string };
  const porLabel = limpar(e.labels?.[0]?.innerText);
  return (
    limpar(el.getAttribute("aria-label")) || porLabel || limpar(e.innerText) || limpar(el.getAttribute("title")) ||
    limpar(e.placeholder) || limpar(el.getAttribute("name")) || limpar(el.getAttribute("value")) || "(sem nome)"
  );
}

function tipoDe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute("role");
  if (tag === "a") return "link";
  if (role === "tab") return "aba";
  if (role === "switch") return "interruptor";
  if (role === "checkbox" || (tag === "input" && (el as HTMLInputElement).type === "checkbox")) return "caixa";
  if (role === "combobox" || tag === "select") return "seleção";
  if (role === "option") return "opção";
  if (role === "menuitem") return "item de menu";
  if (tag === "input" || tag === "textarea") return "campo";
  return "botão";
}

function ehSegredo(el: Element): boolean {
  if (el instanceof HTMLInputElement && (el.type === "password" || el.type === "file")) return true;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return SEGREDO.test(`${rotuloDe(el)} ${el.getAttribute("name") ?? ""} ${el.getAttribute("autocomplete") ?? ""} ${el.id}`);
  }
  return false;
}

export type Risco = "livre" | "aprovacao" | "bloqueado";

export function classificar(el: Element): Risco {
  const rotulo = rotuloDe(el);
  if (ehSegredo(el) || BLOQUEADO.test(rotulo)) return "bloqueado";
  const tag = el.tagName.toLowerCase();
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    return href.startsWith("/") && !href.startsWith("//") ? "livre" : "aprovacao"; // sair do sistema pede aprovação
  }
  if (el.getAttribute("role") === "tab") return "livre";
  if (el.hasAttribute("aria-haspopup") || el.hasAttribute("aria-expanded") || tag === "summary") return "livre";
  if (tag === "input" || tag === "textarea") return "livre"; // clicar num campo só dá foco
  if (el.getAttribute("role") === "option" || el.getAttribute("role") === "switch" || el.getAttribute("role") === "checkbox") return "aprovacao";
  if (LIVRE.test(rotulo) && !(el as HTMLButtonElement).form) return "livre";
  return "aprovacao";
}

/** Captura o que o usuário está vendo: texto visível + controles com ids (v1, v2…). */
export function capturarTela(): SnapshotTela {
  document.querySelectorAll("[data-vita-id]").forEach((n) => n.removeAttribute("data-vita-id"));
  const dialogo = document.querySelector<HTMLElement>('[role="dialog"][data-state="open"]');
  const raiz: HTMLElement = dialogo ?? document.querySelector<HTMLElement>("main") ?? document.body;

  const elementos: ElementoTela[] = [];
  let n = 0;
  for (const el of Array.from(raiz.querySelectorAll(SELETOR))) {
    if (elementos.length >= MAX_ELEMENTOS_TELA) break;
    if (dentroDaVita(el) || !visivel(el)) continue;
    const id = `v${++n}`;
    el.setAttribute("data-vita-id", id);
    const tipo = tipoDe(el);
    const segredo = ehSegredo(el);
    const campo = el as HTMLInputElement;
    const estados: string[] = [];
    if (el.getAttribute("aria-checked") === "true" || (el instanceof HTMLInputElement && el.type === "checkbox" && el.checked)) estados.push("marcado");
    if (el.getAttribute("aria-selected") === "true") estados.push("selecionado");
    if (el.getAttribute("aria-expanded") === "true") estados.push("expandido");
    if (el.getAttribute("aria-pressed") === "true") estados.push("ativo");
    if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") estados.push("desativado");
    if (segredo) estados.push("bloqueado (sensível)");
    else if (BLOQUEADO.test(rotuloDe(el))) estados.push("bloqueado por segurança");
    elementos.push({
      id, tipo, rotulo: rotuloDe(el),
      ...(tipo === "campo" || tipo === "seleção" ? (!segredo && campo.value ? { valor: limpar(campo.value, 120) } : {}) : {}),
      ...(estados.length ? { estado: estados.join(", ") } : {}),
      ...(el.tagName === "A" ? { destino: limpar(el.getAttribute("href"), 160) } : {}),
    });
  }

  const textoBruto = (raiz.innerText || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return {
    url: location.pathname + location.search,
    titulo: limpar(document.title, 120),
    texto: textoBruto.slice(0, MAX_TEXTO_TELA),
    elementos,
    ...(dialogo ? { dialogo: true } : {}),
  };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function destacar(el: HTMLElement) {
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("vita-destaque");
  setTimeout(() => el.classList.remove("vita-destaque"), 1600);
}

function definirValor(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, valor: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, valor); // funciona com campos controlados pelo React
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export type OpcoesExecucao = {
  /** Mostra o cartão de aprovação e devolve a decisão do usuário. */
  aprovar: (descricao: string) => Promise<boolean>;
  /** Navega para um caminho interno (router.push). */
  navegar: (caminho: string) => void;
};

/** Executa um pedido da Vita na tela do usuário, aplicando as travas. */
export async function executarPedidoTela(p: PedidoTela, o: OpcoesExecucao): Promise<ResultadoTela> {
  try {
    if (p.acao === "ver") {
      return { ok: true, mensagem: "Tela atual.", pagina: capturarTela() };
    }

    if (p.acao === "navegar") {
      const c = p.caminho.trim();
      if (!c.startsWith("/") || c.startsWith("//") || /^\/(api|login|auth)(\/|$)/.test(c)) {
        return { ok: false, mensagem: "Só abro páginas internas do sistema (não /api, /login nem /auth)." };
      }
      o.navegar(c);
      await esperar(1500);
      return { ok: true, mensagem: `Abri ${c}.`, pagina: capturarTela() };
    }

    const el = document.querySelector<HTMLElement>(`[data-vita-id="${CSS.escape(p.elemento)}"]`);
    if (!el || !el.isConnected) return { ok: false, mensagem: "Não achei esse elemento (a tela mudou). Use ver_pagina para ler a tela de novo.", pagina: capturarTela() };
    if (dentroDaVita(el)) return { ok: false, mensagem: "Não posso mexer no painel da própria Vita." };
    const rotulo = rotuloDe(el);

    if (p.acao === "preencher") {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
        return { ok: false, mensagem: `«${rotulo}» não é um campo preenchível.` };
      }
      if (ehSegredo(el) || BLOQUEADO.test(rotulo)) return { ok: false, mensagem: "Campo bloqueado por segurança (senha, token, chave ou arquivo). Isso é só com o usuário." };
      if (el.disabled || (el instanceof HTMLInputElement && el.readOnly)) return { ok: false, mensagem: `«${rotulo}» está desativado.` };
      destacar(el);
      el.focus();
      definirValor(el, p.valor);
      await esperar(500);
      return { ok: true, mensagem: `Preenchi «${rotulo}».`, pagina: capturarTela() };
    }

    // clicar
    const risco = classificar(el);
    if (risco === "bloqueado") return { ok: false, mensagem: `Bloqueado por segurança: «${rotulo}». Isso (emitir/cancelar nota, assinar, senhas/chaves) só o usuário pode fazer.` };
    if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return { ok: false, mensagem: `«${rotulo}» está desativado agora.` };
    destacar(el);
    if (risco === "aprovacao") {
      const ok = await o.aprovar(`${p.motivo ? `${p.motivo} — ` : ""}clicar em «${rotulo}»`);
      if (!ok) return { ok: false, recusado: true, mensagem: `O usuário recusou clicar em «${rotulo}».` };
    }
    el.click();
    await esperar(el.tagName === "A" ? 1500 : 900);
    return { ok: true, mensagem: `Cliquei em «${rotulo}».`, pagina: capturarTela() };
  } catch (e) {
    return { ok: false, mensagem: `Falha ao executar na tela: ${e instanceof Error ? e.message : "erro desconhecido"}.` };
  }
}
