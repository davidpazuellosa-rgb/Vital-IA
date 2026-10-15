import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { consultarDados } from "./banco";
import type { ContextoFerramenta, ResultadoFerramenta } from "./ferramentas";
import { gerarDocx } from "./arquivos/docx";
import { EXTENSAO, MIME, limparTexto, type Bloco, type Celula, type DocumentoGerado, type FormatoArquivo, type Tabela } from "./arquivos/modelo";
import { gerarPdf } from "./arquivos/pdf";
import { gerarXlsx, type ImagemGrafico } from "./arquivos/xlsx";
import { renderizarPng } from "./graficos/png";
import { resolverGrafico } from "./graficos/resolver";
import type { GraficoSpec } from "./graficos/tipos";

/* ---------------------------------------------------------------------------------------------
 * gerar_arquivo: monta uma planilha (.xlsx), um PDF ou um documento Word (.docx) para o usuário BAIXAR.
 * Só leitura: nada no sistema é alterado (por isso não pede aprovação). O arquivo fica na pasta da empresa
 * (vita/gerados) e é entregue por /api/vita/arquivo, que confere o dono antes de baixar.
 * Listas do banco podem vir direto de `fonte_dados` (mesmas regras do consultar_dados), sem a Vita redigitar.
 * ------------------------------------------------------------------------------------------- */

const json = (v: unknown) => JSON.stringify(v);
const MAX_TABELAS = 12;
const MAX_BLOCOS = 200;
const MAX_GRAFICOS = 10;
const MAX_LINHAS_PLANILHA = 5_000;
const MAX_LINHAS_DOCUMENTO = 500; // PDF/Word com milhares de linhas não servem: use planilha

type Args = Record<string, unknown>;
type TabelaEntrada = { titulo?: unknown; nome?: unknown; colunas?: unknown; linhas?: unknown; fonte_dados?: unknown };

/** Palavras comuns dos nomes de coluna do banco, com acento e sigla certos. */
const PALAVRAS: Record<string, string> = {
  titulo: "título", orgao: "órgão", municipio: "município", situacao: "situação", descricao: "descrição", observacoes: "observações",
  codigo: "código", preco: "preço", referencia: "referência", razao: "razão", juridica: "jurídica", numero: "número", emissao: "emissão",
  publicacao: "publicação", inscricao: "inscrição", minima: "mínima", maxima: "máxima", operacao: "operação", execucao: "execução",
  ultima: "última", serie: "série", destinatario: "destinatário", bancarios: "bancários", validade: "validade", periodo: "período",
  uf: "UF", cnpj: "CNPJ", cnae: "CNAE", pncp: "PNCP", id: "ID", cep: "CEP", cpf: "CPF", email: "e-mail", ufs: "UFs", nf: "NF", nfe: "NF-e",
  catalogo: "catálogo", usuario: "usuário", responsavel: "responsável", telefone: "telefone", endereco: "endereço", contratacao: "contratação",
  contratacoes: "contratações", licitacao: "licitação", licitacoes: "licitações", proposta: "proposta", dias: "dias", disponivel: "disponível",
};
const bonito = (coluna: string) => {
  const t = coluna.replace(/_/g, " ").trim().split(/\s+/).map((p) => PALAVRAS[p.toLowerCase()] ?? p).join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function celula(v: unknown): Celula {
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Manaus" }).replace(",", "");
    }
    return limparTexto(v);
  }
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  return limparTexto(JSON.stringify(v), 2_000);
}

async function resolverTabela(t: TabelaEntrada, ctx: ContextoFerramenta, limite: number): Promise<{ tabela: Tabela; aviso?: string } | { erro: string }> {
  // 1) direto do banco
  if (t.fonte_dados && typeof t.fonte_dados === "object") {
    const fonte = t.fonte_dados as Record<string, unknown>;
    const pedido = Math.min(limite, Math.max(1, Number(fonte.limite) || 1_000));
    const bruto = JSON.parse(await consultarDados({ ...fonte, limite: pedido }, ctx.supabase, ctx.empresas, MAX_LINHAS_PLANILHA)) as { erro?: string; total?: number; linhas?: Array<Record<string, unknown>> };
    if (bruto.erro) return { erro: bruto.erro };
    const linhas = bruto.linhas ?? [];
    const colunasPedidas = Array.isArray(fonte.colunas) ? fonte.colunas.map(String) : [];
    const colunas = linhas.length ? Object.keys(linhas[0]) : colunasPedidas;
    if (!linhas.length) return { tabela: { colunas: ["Resultado"], linhas: [["Nenhum registro encontrado."]] } };
    const aviso = (bruto.total ?? 0) > linhas.length ? `a consulta tem ${bruto.total} registros; a tabela traz os primeiros ${linhas.length}` : undefined;
    return { tabela: { colunas: colunas.map(bonito), linhas: linhas.map((l) => colunas.map((c) => celula(l[c]))) }, aviso };
  }
  // 2) linhas informadas pela Vita (ex.: resultados de uma busca no PNCP)
  const colunas = Array.isArray(t.colunas) ? t.colunas.map((c) => limparTexto(c, 120)) : [];
  if (!colunas.length) return { erro: "Cada tabela precisa de `colunas` (lista de títulos) e `linhas`, ou de `fonte_dados`." };
  const bruto = Array.isArray(t.linhas) ? t.linhas : [];
  const linhas = bruto.slice(0, limite).map((l) =>
    Array.isArray(l) ? colunas.map((_, i) => celula(l[i])) : colunas.map((c) => celula((l as Record<string, unknown>)?.[c])));
  return { tabela: { colunas, linhas }, aviso: bruto.length > limite ? `a tabela foi cortada em ${limite} linhas` : undefined };
}

/** Procura nas respostas anteriores da conversa um gráfico que a Vita já mostrou (pelo id). */
async function graficoDaConversa(ctx: ContextoFerramenta, id: string): Promise<GraficoSpec | null> {
  const dessa = ctx.graficos?.get(id);
  if (dessa) return dessa;
  if (!ctx.conversaId) return null;
  const { data } = await ctx.supabase.from("vita_mensagens").select("dados").eq("conversa_id", ctx.conversaId).eq("papel", "assistant").order("created_at", { ascending: false }).limit(60);
  for (const m of data ?? []) {
    const achado = ((m.dados as { graficos?: GraficoSpec[] })?.graficos ?? []).find((g) => g.id === id);
    if (achado) return achado;
  }
  return null;
}

export async function gerarArquivo(args: Args, ctx: ContextoFerramenta): Promise<ResultadoFerramenta> {
  const formato = String(args.formato ?? "").toLowerCase() as FormatoArquivo;
  if (!["xlsx", "pdf", "docx"].includes(formato)) return { paraModelo: json({ erro: "`formato` deve ser xlsx (planilha), pdf ou docx (Word)." }) };
  const titulo = limparTexto(args.titulo, 150).trim();
  if (!titulo) return { paraModelo: json({ erro: "Informe o `titulo` do arquivo." }) };
  const limite = formato === "xlsx" ? MAX_LINHAS_PLANILHA : MAX_LINHAS_DOCUMENTO;

  const abas = Array.isArray(args.abas) ? (args.abas as TabelaEntrada[]) : [];
  const blocosEntrada = Array.isArray(args.blocos) ? (args.blocos as Array<Record<string, unknown>>) : [];
  if (blocosEntrada.length > MAX_BLOCOS) return { paraModelo: json({ erro: `No máximo ${MAX_BLOCOS} blocos.` }) };

  const avisos: string[] = [];
  const blocos: Bloco[] = [];
  const planilhas: Array<{ nome: string; tabela: Tabela }> = [];
  let totalTabelas = 0;
  let totalGraficos = 0;
  const imagens: ImagemGrafico[] = [];
  const adicionarTabela = async (entrada: TabelaEntrada, nome: string) => {
    if (++totalTabelas > MAX_TABELAS) return { erro: `No máximo ${MAX_TABELAS} tabelas por arquivo.` };
    const r = await resolverTabela(entrada, ctx, limite);
    if ("erro" in r) return r;
    if (r.aviso) avisos.push(`${nome}: ${r.aviso}`);
    planilhas.push({ nome, tabela: r.tabela });
    blocos.push({ tipo: "tabela", titulo: nome, tabela: r.tabela });
    return null;
  };

  try {
    for (const b of blocosEntrada) {
      const tipo = String(b.tipo ?? "");
      if (tipo === "tabela") {
        const e = await adicionarTabela(b as TabelaEntrada, limparTexto(b.titulo ?? b.nome ?? `Tabela ${totalTabelas + 1}`, 80));
        if (e) return { paraModelo: json(e) };
      } else if (tipo === "grafico") {
        if (++totalGraficos > MAX_GRAFICOS) return { paraModelo: json({ erro: `No máximo ${MAX_GRAFICOS} gráficos por arquivo.` }) };
        let spec: GraficoSpec | null = null;
        if (b.grafico_id) {
          spec = await graficoDaConversa(ctx, String(b.grafico_id));
          if (!spec) return { paraModelo: json({ erro: `Não achei o gráfico "${String(b.grafico_id)}" nesta conversa. Crie-o de novo com criar_grafico ou passe os dados no bloco (tipo_grafico, categorias, series ou fonte_dados).` }) };
        } else {
          const r = await resolverGrafico({ ...b, tipo: b.tipo_grafico ?? "colunas" }, ctx);
          if ("erro" in r) return { paraModelo: json({ erro: r.erro }) };
          if (r.aviso) avisos.push(`Gráfico "${r.grafico.titulo}": ${r.aviso}`);
          spec = r.grafico;
        }
        const img = renderizarPng(spec, 1400);
        imagens.push({ titulo: spec.titulo, ...img });
        blocos.push({ tipo: "grafico", titulo: spec.titulo, ...img });
      } else if (tipo === "lista") {
        const itens = Array.isArray(b.itens) ? b.itens.map((i) => limparTexto(i, 1_000)).filter(Boolean) : [];
        if (itens.length) blocos.push({ tipo: "lista", itens });
      } else if (tipo === "titulo" || tipo === "subtitulo" || tipo === "paragrafo") {
        const texto = limparTexto(b.texto, 8_000);
        if (texto) blocos.push({ tipo, texto } as Bloco);
      }
    }
    for (const a of abas) {
      const e = await adicionarTabela(a, limparTexto(a.nome ?? a.titulo ?? `Planilha ${totalTabelas + 1}`, 60));
      if (e) return { paraModelo: json(e) };
    }
  } catch (e) {
    return { paraModelo: json({ erro: e instanceof Error ? e.message : "Falha ao montar o conteúdo." }) };
  }
  if (formato === "xlsx" && !planilhas.length && !imagens.length) return { paraModelo: json({ erro: "Para a planilha informe `abas` (cada uma com colunas e linhas, ou fonte_dados) e/ou blocos de gráfico." }) };
  if (formato !== "xlsx" && !blocos.length) return { paraModelo: json({ erro: "Informe `blocos` (titulo, subtitulo, paragrafo, lista ou tabela) para o documento." }) };

  const geradoEm = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Manaus" });
  const documento: DocumentoGerado = { titulo, blocos };
  let bytes: Uint8Array;
  try {
    bytes = formato === "xlsx" ? gerarXlsx(planilhas, imagens) : formato === "pdf" ? await gerarPdf(documento, geradoEm) : gerarDocx(documento, geradoEm);
  } catch (e) {
    return { paraModelo: json({ erro: `Não consegui montar o arquivo: ${e instanceof Error ? e.message : "erro desconhecido"}.` }) };
  }
  if (bytes.length > 20 * 1024 * 1024) return { paraModelo: json({ erro: "O arquivo passou de 20 MB. Reduza as linhas ou separe em partes." }) };

  const dono = await resolverEmpresaUserId(ctx.supabase, ctx.userId);
  const caminho = `${dono}/vita/gerados/${ctx.userId}/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${EXTENSAO[formato]}`;
  const { error } = await ctx.supabase.storage.from("documentos").upload(caminho, bytes, { contentType: MIME[formato], upsert: false });
  if (error) return { paraModelo: json({ erro: `Não consegui guardar o arquivo: ${error.message}` }) };

  const nomeAmigavel = `${titulo.replace(/[\\/:*?"<>|\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)}.${EXTENSAO[formato]}`;
  const link = `/api/vita/arquivo?p=${encodeURIComponent(caminho)}&n=${encodeURIComponent(nomeAmigavel)}`;
  return {
    paraModelo: json({
      resultado: "Arquivo gerado e pronto para baixar.",
      arquivo: nomeAmigavel,
      formato,
      tamanho_kb: Math.max(1, Math.round(bytes.length / 1024)),
      tabelas: planilhas.map((p) => ({ nome: p.nome, linhas: p.tabela.linhas.length })),
      ...(imagens.length ? { graficos: imagens.map((g) => g.titulo) } : {}),
      ...(avisos.length ? { avisos } : {}),
      link_download: link,
      como_usar: `Mostre ao usuário o link EXATAMENTE assim: [Baixar ${nomeAmigavel}](${link}). Diga em uma frase o que o arquivo contém e repita os avisos, se houver.`,
    }),
  };
}
