import type { SupabaseClient } from "@supabase/supabase-js";
import { formatarMoeda } from "@/lib/format";
import { buscarItensPncp } from "@/lib/licitacoes/providers/pncp-itens";
import { lerCamposNota } from "@/lib/nota-fiscal/campos";
import { atualizarNotaFiscalRascunho, criarNotaFiscal } from "@/lib/nota-fiscal/actions";
import { salvarRascunhoProposta, type ItemPropostaRascunho } from "@/lib/propostas/actions";
import type { AcaoProposta, DetalheAcao } from "./ferramentas";

/* ---------------------------------------------------------------------------------------------
 * Rascunhos que a Vita pode preparar (sempre com aprovação):
 *  - NOTA FISCAL: cria/edita só RASCUNHO, com a mesma validação da tela. Emitir/cancelar: só na tela.
 *  - PROPOSTA: preenche marca, valor unitário e seleção dos itens do rascunho. Proposta enviada: nunca.
 * A execução chama as mesmas funções que as telas usam.
 * ------------------------------------------------------------------------------------------- */

type Resultado = { paraModelo: string; acao?: AcaoProposta };
const json = (v: unknown) => JSON.stringify(v);
const txt = (v: unknown) => (v == null ? "" : String(v).trim());
const erro = (e: unknown): Resultado => ({ paraModelo: json({ erro: e instanceof Error ? e.message : "Pedido inválido." }) });
const PENDENTE = json({ resultado: "PENDENTE: cartão de aprovação exibido ao usuário. Ainda NÃO foi feito — não diga que foi." });

/* ------------------------------------- nota fiscal ------------------------------------- */

const CAMPO_FORM: Record<string, string> = {
  nome: "destinatarioNome", documento: "destinatarioDocumento", ie: "destinatarioIe", ind_ie: "destinatarioIndIe",
  cep: "destinatarioCep", logradouro: "destinatarioLogradouro", numero: "destinatarioNumero", bairro: "destinatarioBairro",
  municipio: "destinatarioMunicipio", uf: "destinatarioUf",
};

function paraFormData(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

export async function proporNotaFiscal(args: Record<string, unknown>, supabase: SupabaseClient): Promise<Resultado> {
  try {
    const id = txt(args.id) || null;
    const campos: Record<string, string> = {};

    // Edição: parte do rascunho atual (o que não vier no pedido continua igual).
    if (id) {
      const { data: nota } = await supabase.from("notas_fiscais").select("*").eq("id", id).maybeSingle();
      if (!nota) throw new Error("Nota não encontrada.");
      if (nota.status !== "rascunho") throw new Error(`Esta nota está "${nota.status}". Só rascunhos podem ser editados pela Vita.`);
      Object.assign(campos, {
        clienteId: txt(nota.cliente_id), contratacaoId: txt(nota.contratacao_id), naturezaOperacao: txt(nota.natureza_operacao),
        observacoes: txt(nota.observacoes), itens: JSON.stringify(nota.itens ?? []),
        destinatarioNome: txt(nota.destinatario_nome), destinatarioDocumento: txt(nota.destinatario_documento),
        destinatarioIe: txt(nota.destinatario_ie), destinatarioIndIe: txt(nota.destinatario_ind_ie),
        destinatarioCep: txt(nota.destinatario_cep), destinatarioLogradouro: txt(nota.destinatario_logradouro),
        destinatarioNumero: txt(nota.destinatario_numero), destinatarioBairro: txt(nota.destinatario_bairro),
        destinatarioMunicipio: txt(nota.destinatario_municipio), destinatarioUf: txt(nota.destinatario_uf),
      });
    }
    if ("cliente_id" in args) campos.clienteId = txt(args.cliente_id);
    if ("contratacao_id" in args) campos.contratacaoId = txt(args.contratacao_id);
    if ("natureza_operacao" in args) campos.naturezaOperacao = txt(args.natureza_operacao);
    if ("observacoes" in args) campos.observacoes = txt(args.observacoes);
    if (Array.isArray(args.itens)) campos.itens = JSON.stringify(args.itens);

    // Sem destinatário informado, usa os dados do órgão salvos no cliente (como a tela faz).
    const dest = (args.destinatario && typeof args.destinatario === "object" ? args.destinatario : {}) as Record<string, unknown>;
    if (!Object.keys(dest).length && campos.clienteId && !campos.destinatarioNome) {
      const { data: c } = await supabase.from("clientes")
        .select("nome, cnpj, inscricao_estadual, cep, logradouro, numero, bairro, municipio, uf").eq("id", campos.clienteId).maybeSingle();
      if (!c) throw new Error("Cliente não encontrado.");
      Object.assign(campos, {
        destinatarioNome: txt(c.nome), destinatarioDocumento: txt(c.cnpj), destinatarioIe: txt(c.inscricao_estadual),
        destinatarioCep: txt(c.cep), destinatarioLogradouro: txt(c.logradouro), destinatarioNumero: txt(c.numero),
        destinatarioBairro: txt(c.bairro), destinatarioMunicipio: txt(c.municipio), destinatarioUf: txt(c.uf),
      });
    }
    for (const [k, v] of Object.entries(dest)) if (CAMPO_FORM[k]) campos[CAMPO_FORM[k]] = txt(v);

    const c = lerCamposNota(paraFormData(campos)); // mesma validação da tela (lança com mensagem clara)
    const detalhes: DetalheAcao[] = [
      { rotulo: "Destinatário", valor: `${c.destinatarioNome} · ${c.destinatarioDocumento}` },
      { rotulo: "Endereço", valor: `${c.destLogradouro}, ${c.destNumero} — ${c.destBairro}, ${c.destMunicipio}/${c.destUf} · CEP ${c.destCep}` },
      { rotulo: "Natureza", valor: c.naturezaOperacao },
      ...c.itens.slice(0, 12).map((it, i) => ({
        rotulo: `Item ${i + 1}`,
        valor: `${it.descricao} — ${it.quantidade} ${it.unidade} × ${formatarMoeda(it.valor_unitario)} · NCM ${it.ncm} · CFOP ${it.cfop}`,
      })),
      ...(c.itens.length > 12 ? [{ rotulo: "…", valor: `e mais ${c.itens.length - 12} itens` }] : []),
      { rotulo: "Total", valor: formatarMoeda(c.valorTotal) },
    ];
    if (c.observacoes) detalhes.push({ rotulo: "Observações", valor: c.observacoes.slice(0, 300) });
    const motivo = txt(args.motivo);
    if (motivo) detalhes.push({ rotulo: "Motivo", valor: motivo });
    return {
      paraModelo: PENDENTE,
      acao: {
        tipo: "rascunho_nota_fiscal",
        parametros: { id, campos },
        resumo: id ? "Alterar rascunho de nota fiscal" : "Criar rascunho de nota fiscal",
        detalhes,
        aviso: "Fica como RASCUNHO. A emissão continua sendo feita por você, na tela Nota Fiscal.",
      },
    };
  } catch (e) {
    return erro(e);
  }
}

export async function executarNotaFiscal(p: Record<string, unknown>): Promise<string> {
  const campos = (p.campos ?? {}) as Record<string, string>;
  const id = p.id ? String(p.id) : null;
  if (id) {
    await atualizarNotaFiscalRascunho(id, paraFormData(campos)); // recusa se já não for rascunho
    return "Rascunho da nota fiscal atualizado. Para emitir, abra a tela Nota Fiscal.";
  }
  await criarNotaFiscal(paraFormData(campos));
  return "Rascunho de nota fiscal criado. Para emitir, abra a tela Nota Fiscal.";
}

/* --------------------------------------- proposta --------------------------------------- */

type Mudanca = { numero_item: number; marca?: string; valor_unitario?: number; selecionado?: boolean };

async function localizarLicitacao(supabase: SupabaseClient, args: Record<string, unknown>) {
  const numero = txt(args.numero_controle_pncp);
  if (!numero) throw new Error("Informe o nº de controle PNCP da licitação.");
  const { data } = await supabase.from("saved_licitacoes").select("id, titulo, orgao").eq("numero_controle_pncp", numero).limit(1).maybeSingle();
  if (!data) throw new Error("Essa licitação não está em Minhas Licitações. Salve-a antes de montar a proposta.");
  return { id: String(data.id), numero, titulo: txt(data.titulo), orgao: txt(data.orgao) };
}

/** Itens atuais do rascunho; sem rascunho ainda, parte dos itens do PNCP (como o diálogo faz). */
async function itensBase(supabase: SupabaseClient, licitacaoId: string, numero: string): Promise<{ itens: ItemPropostaRascunho[]; status: string | null }> {
  const { data: prop } = await supabase.from("propostas").select("status, itens").eq("licitacao_id", licitacaoId).maybeSingle();
  if (prop?.status === "enviada") throw new Error("A proposta desta licitação já foi ENVIADA; não pode mais ser alterada.");
  const salvos = Array.isArray(prop?.itens) ? (prop.itens as ItemPropostaRascunho[]) : [];
  if (salvos.length) return { itens: salvos.map((i) => ({ ...i })), status: prop?.status ?? null };
  const pncp = await buscarItensPncp(numero);
  if (!pncp.length) throw new Error("Não consegui ler os itens desta licitação no PNCP agora. Tente de novo em instantes.");
  return {
    status: prop?.status ?? null,
    itens: pncp.map((i) => ({
      numeroItem: i.numeroItem, descricao: i.descricao, quantidade: i.quantidade, unidadeMedida: i.unidadeMedida,
      marca: "", valorUnitario: 0, selecionado: true,
    })),
  };
}

function lerMudancas(bruto: unknown): Mudanca[] {
  if (!Array.isArray(bruto) || !bruto.length) throw new Error("Informe os itens a preencher (numero_item e marca/valor_unitario/selecionado).");
  return bruto.map((m) => {
    const r = (m ?? {}) as Record<string, unknown>;
    const n = Number(r.numero_item);
    if (!Number.isInteger(n)) throw new Error("Cada item precisa do numero_item.");
    const out: Mudanca = { numero_item: n };
    if (r.marca != null) out.marca = txt(r.marca);
    if (r.valor_unitario != null) {
      const v = typeof r.valor_unitario === "number" ? r.valor_unitario : Number(String(r.valor_unitario).replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(v) || v < 0) throw new Error(`Item ${n}: valor unitário inválido.`);
      out.valor_unitario = Math.round(v * 100) / 100;
    }
    if (typeof r.selecionado === "boolean") out.selecionado = r.selecionado;
    return out;
  });
}

function aplicar(itens: ItemPropostaRascunho[], mudancas: Mudanca[]): ItemPropostaRascunho[] {
  const faltando = mudancas.filter((m) => !itens.some((i) => i.numeroItem === m.numero_item)).map((m) => m.numero_item);
  if (faltando.length) throw new Error(`Itens que não existem nesta licitação: ${faltando.join(", ")}.`);
  return itens.map((i) => {
    const m = mudancas.find((x) => x.numero_item === i.numeroItem);
    if (!m) return i;
    return { ...i, marca: m.marca ?? i.marca, valorUnitario: m.valor_unitario ?? i.valorUnitario, selecionado: m.selecionado ?? i.selecionado };
  });
}

const valorGlobal = (itens: ItemPropostaRascunho[]) =>
  itens.filter((i) => i.selecionado).reduce((s, i) => s + (i.quantidade ?? 0) * (i.valorUnitario || 0), 0);

export async function proporProposta(args: Record<string, unknown>, supabase: SupabaseClient): Promise<Resultado> {
  try {
    const lic = await localizarLicitacao(supabase, args);
    const mudancas = lerMudancas(args.itens);
    const { itens } = await itensBase(supabase, lic.id, lic.numero);
    const novos = aplicar(itens, mudancas);

    const detalhes: DetalheAcao[] = [{ rotulo: "Licitação", valor: `${lic.titulo.slice(0, 120)} · ${lic.orgao}` }];
    const alterados = novos.filter((n, idx) => JSON.stringify(n) !== JSON.stringify(itens[idx]));
    if (!alterados.length) return { paraModelo: json({ resultado: "Nada muda: os itens já estão assim." }) };
    for (const n of alterados.slice(0, 20)) {
      const a = itens.find((i) => i.numeroItem === n.numeroItem)!;
      const partes: string[] = [];
      if (a.marca !== n.marca) partes.push(`marca: ${a.marca || "—"} → ${n.marca || "—"}`);
      if (a.valorUnitario !== n.valorUnitario) partes.push(`valor: ${a.valorUnitario ? formatarMoeda(a.valorUnitario) : "—"} → ${formatarMoeda(n.valorUnitario)}`);
      if (a.selecionado !== n.selecionado) partes.push(n.selecionado ? "incluir na proposta" : "tirar da proposta");
      detalhes.push({ rotulo: `Item ${n.numeroItem}`, valor: `${n.descricao.slice(0, 70)} — ${partes.join(" · ")}` });
    }
    if (alterados.length > 20) detalhes.push({ rotulo: "…", valor: `e mais ${alterados.length - 20} itens` });
    detalhes.push({ rotulo: "Valor global", valor: `${formatarMoeda(valorGlobal(itens))} → ${formatarMoeda(valorGlobal(novos))}` });
    const motivo = txt(args.motivo);
    if (motivo) detalhes.push({ rotulo: "Motivo", valor: motivo });
    return {
      paraModelo: PENDENTE,
      acao: {
        tipo: "preencher_proposta",
        parametros: { licitacao_id: lic.id, numero: lic.numero, mudancas },
        resumo: `Preencher rascunho da proposta (${alterados.length} ${alterados.length === 1 ? "item" : "itens"})`,
        detalhes,
        aviso: "Salva como rascunho. Gerar o PDF, assinar e enviar continuam com você.",
      },
    };
  } catch (e) {
    return erro(e);
  }
}

/** Reaplica as mudanças sobre o rascunho ATUAL (pode ter mudado desde o pedido) e salva. */
export async function executarProposta(supabase: SupabaseClient, p: Record<string, unknown>): Promise<string> {
  const licitacaoId = String(p.licitacao_id ?? "");
  const { itens } = await itensBase(supabase, licitacaoId, String(p.numero ?? ""));
  const novos = aplicar(itens, (p.mudancas ?? []) as Mudanca[]);
  await salvarRascunhoProposta(licitacaoId, novos);
  return `Rascunho da proposta salvo (valor global ${formatarMoeda(valorGlobal(novos))}). Abra "Criar proposta / Abrir rascunho" para revisar e gerar o PDF.`;
}
