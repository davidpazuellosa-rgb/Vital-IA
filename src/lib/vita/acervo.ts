import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { registrarDocumento } from "@/lib/documentos/actions";
import { GRUPOS_DOCUMENTOS, TIPO_AVULSO, TODOS_TIPOS, nomeTipo } from "@/lib/documentos/types";
import { configEmpresa } from "@/lib/empresas";
import { empresaAlvo } from "./empresa-alvo";
import type { ContextoFerramenta, ResultadoFerramenta } from "./ferramentas";

/* ---------------------------------------------------------------------------------------------
 * anexar_ao_acervo: guarda em Documentos (acervo da Vital Norte ou da RM) os arquivos que o usuário
 * anexou no chat. Só PROPÕE (cartão de aprovação); ao aprovar, copia o arquivo para a pasta do acervo
 * e cadastra o documento, igual ao botão "Adicionar documento" da tela.
 * ------------------------------------------------------------------------------------------- */

const json = (v: unknown) => JSON.stringify(v);
const MAX_ARQUIVOS = 20;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_VALIDOS = new Set(TODOS_TIPOS.map((t) => t.slug));

/** Lista de tipos por grupo para o modelo: cada grupo aceita quantos documentos forem precisos; o "outros" do grupo serve para o que não tem tipo próprio. */
export const TIPOS_PARA_MODELO = GRUPOS_DOCUMENTOS.map((g) => `${g.titulo}: ${[...g.tipos, g.extra].map((t) => `${t.slug} (${t.nome})`).join(", ")}`).join(" | ");

const sanitizar = (nome: string) => nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);
/** Nome de exibição limpo: sem barras nem caracteres de controle, no máximo 100 caracteres. */
const limparNome = (v: string) => v.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
const dataOuNulo = (v: unknown) => (typeof v === "string" && DATA.test(v.trim()) ? v.trim() : null);
const mimeDe = (nome: string) => (/\.pdf$/i.test(nome) ? "application/pdf" : /\.(png)$/i.test(nome) ? "image/png" : /\.(jpe?g)$/i.test(nome) ? "image/jpeg" : "application/octet-stream");

type AnexoDaConversa = { nome: string; path: string; tipo?: string };

/** Anexos enviados nesta conversa (do mais recente para o mais antigo), por nome. */
export async function anexosDaConversa(supabase: SupabaseClient, conversaId: string): Promise<Map<string, AnexoDaConversa>> {
  const { data } = await supabase
    .from("vita_mensagens")
    .select("dados, created_at")
    .eq("conversa_id", conversaId)
    .eq("papel", "user")
    .order("created_at", { ascending: false })
    .limit(40);
  const mapa = new Map<string, AnexoDaConversa>();
  for (const m of data ?? []) {
    for (const a of ((m.dados as { anexos?: AnexoDaConversa[] })?.anexos ?? [])) {
      const chave = String(a.nome ?? "").toLowerCase();
      if (chave && a.path && !mapa.has(chave)) mapa.set(chave, a);
    }
  }
  return mapa;
}

export async function proporAnexarAoAcervo(args: Record<string, unknown>, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  const alvo = empresaAlvo(args, ctx.empresas);
  if (!alvo.ok) return { paraModelo: json({ erro: alvo.erro }) };
  const pedidos = Array.isArray(args.arquivos) ? (args.arquivos as Array<Record<string, unknown>>) : [];
  if (!pedidos.length) return { paraModelo: json({ erro: "Informe `arquivos` (nome de cada anexo, tipo e, se houver, datas)." }) };
  if (pedidos.length > MAX_ARQUIVOS) return { paraModelo: json({ erro: `No máximo ${MAX_ARQUIVOS} arquivos por pedido.` }) };
  if (!ctx.conversaId) return { paraModelo: json({ erro: "Sem conversa ativa." }) };

  const anexos = await anexosDaConversa(ctx.supabase, ctx.conversaId);
  const itens: Array<{ path: string; arquivoNome: string; tipo: string; nome: string; emissao: string | null; validade: string | null }> = [];
  const detalhes: Array<{ rotulo: string; valor: string }> = [];
  for (const [i, p] of pedidos.entries()) {
    const nomeArquivo = String(p.arquivo ?? "").trim();
    const a = anexos.get(nomeArquivo.toLowerCase());
    if (!a) return { paraModelo: json({ erro: `Não achei o anexo "${nomeArquivo}" nesta conversa. Anexos disponíveis: ${[...anexos.values()].map((x) => x.nome).join(", ") || "nenhum"}.` }) };
    if (a.tipo === "zip") return { paraModelo: json({ erro: `"${a.nome}" é um ZIP: peça ao usuário para anexar os arquivos soltos (ou uma pasta) para guardá-los no acervo.` }) };
    const tipo = TIPOS_VALIDOS.has(String(p.tipo)) ? String(p.tipo) : TIPO_AVULSO;
    const extensao = (a.nome.match(/\.[A-Za-z0-9]{1,8}$/) ?? [""])[0];
    const nome = limparNome(String(p.nome ?? "")) || nomeArquivo.replace(/\.[^.]+$/, "");
    // O arquivo guardado também recebe o nome correto (ex.: scan001.pdf → "Cartão CNPJ.pdf").
    const arquivoFinal = limparNome(String(p.nome ?? "")) ? `${nome}${extensao}` : a.nome;
    const emissao = dataOuNulo(p.data_emissao);
    const validade = dataOuNulo(p.data_validade);
    itens.push({ path: a.path, arquivoNome: arquivoFinal, tipo, nome, emissao, validade });
    detalhes.push({
      rotulo: `#${i + 1}`,
      valor: [`${a.nome}`, `guardar como: ${arquivoFinal}`, `tipo: ${nomeTipo(tipo)}`, emissao ? `emissão ${emissao}` : "", validade ? `validade ${validade}` : ""].filter(Boolean).join(" · ").slice(0, 320),
    });
  }
  return {
    paraModelo: json({ resultado: "PENDENTE: cartão de aprovação exibido ao usuário. Os arquivos ainda NÃO foram guardados — não diga que foram." }),
    acao: {
      tipo: "anexar_ao_acervo",
      parametros: { empresa: alvo.slug, itens },
      resumo: `Guardar ${itens.length} arquivo(s) nos Documentos (${alvo.cfg.nome})`,
      detalhes: [{ rotulo: "Empresa", valor: alvo.cfg.nome }, ...detalhes],
    },
  };
}

/** Executa o pedido JÁ APROVADO: copia cada arquivo do chat para o acervo e cadastra o documento. */
export async function executarAnexarAoAcervo(supabase: SupabaseClient, userId: string, parametros: Record<string, unknown>): Promise<string> {
  const cfg = configEmpresa(parametros.empresa);
  const dono = await resolverEmpresaUserId(supabase, userId);
  const itens = (parametros.itens as Array<{ path: string; arquivoNome: string; tipo: string; nome: string; emissao: string | null; validade: string | null }>) ?? [];
  if (!itens.length) throw new Error("Nada a guardar.");
  let ok = 0;
  const falhas: string[] = [];
  for (const it of itens) {
    try {
      if (!it.path.startsWith(`${dono}/vita/`) || it.path.includes("..")) throw new Error("caminho inválido");
      const id = crypto.randomUUID();
      const destino = `${dono}/${cfg.pastaStorage}${id}/${sanitizar(it.arquivoNome)}`;
      const { error: e1 } = await supabase.storage.from("documentos").copy(it.path, destino);
      if (e1) throw new Error(e1.message);
      await registrarDocumento({ empresa: cfg.slug, id, tipo: it.tipo, nome: it.nome, path: destino, arquivoNome: it.arquivoNome, mimeType: mimeDe(it.arquivoNome) });
      if (it.emissao || it.validade) {
        const campos: Record<string, unknown> = {};
        if (it.emissao) campos.data_emissao = it.emissao;
        if (it.validade) { campos.data_validade = it.validade; campos.validade_automatica = false; }
        await supabase.from(cfg.tabelaDocumentos).update(campos).eq("id", id);
      }
      ok++;
    } catch (e) {
      falhas.push(`${it.arquivoNome} (${e instanceof Error ? e.message : "falhou"})`);
    }
  }
  if (!ok) throw new Error(`Nenhum arquivo foi guardado: ${falhas.join("; ")}`);
  return `${ok} arquivo(s) guardado(s) nos Documentos (${cfg.nome})${falhas.length ? `. Falharam: ${falhas.join("; ")}` : "."}`;
}
