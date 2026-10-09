import { NextResponse } from "next/server";
import { strToU8, zipSync } from "fflate";
import { avaliarValidade, tipoSemValidade } from "@/lib/documentos/types";
import type { AnaliseEdital } from "@/lib/propostas/types";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const seguro = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "documento";

/**
 * ZIP com os documentos de habilitação que o edital pede, tirados do acervo da empresa.
 *   GET /api/propostas/<id da licitação salva>/habilitacao
 * Só entram documentos EM DIA (a validade é reavaliada agora, não a da última análise). O
 * LEIAME.txt dentro do ZIP lista o que entrou, o que ficou de fora e o que ainda falta.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

    const [{ data: licitacao }, { data: proposta }] = await Promise.all([
      supabase.from("saved_licitacoes").select("numero_controle_pncp, orgao").eq("id", id).eq("user_id", user.id).single(),
      supabase.from("propostas").select("analise_edital").eq("licitacao_id", id).eq("user_id", user.id).maybeSingle(),
    ]);
    if (!licitacao) return NextResponse.json({ erro: "Licitação não encontrada." }, { status: 404 });
    const analise = proposta?.analise_edital as AnaliseEdital | null;
    if (!analise) return NextResponse.json({ erro: "Analise o edital antes de montar o pacote." }, { status: 409 });

    const requisitos = analise.documentos ?? [];
    const comArquivo = requisitos.filter((r) => r.documentoId);
    const ids = [...new Set(comArquivo.map((r) => String(r.documentoId)))];
    const { data: docs } = ids.length
      ? await supabase.from("documentos").select("id, nome, tipo, arquivo_path, arquivo_nome, data_validade").in("id", ids)
      : { data: [] };
    const porId = new Map((docs ?? []).map((d) => [String(d.id), d]));

    const arquivos: Record<string, Uint8Array> = {};
    const usados = new Set<string>();
    const incluidos: string[] = [];
    const ignorados: string[] = [];
    const jaIncluidos = new Set<string>();

    for (const req of comArquivo) {
      const doc = porId.get(String(req.documentoId));
      if (!doc) { ignorados.push(`${req.nome}: documento não encontrado no acervo.`); continue; }
      if (jaIncluidos.has(doc.id)) continue; // o mesmo arquivo atende a mais de uma exigência
      if (!tipoSemValidade(doc.tipo) && avaliarValidade(doc.data_validade).status === "vencido") {
        ignorados.push(`${req.nome}: "${doc.nome}" está VENCIDO (validade ${doc.data_validade}). Renove antes de enviar.`);
        continue;
      }
      const { data: arquivo } = await supabase.storage.from("documentos").download(doc.arquivo_path);
      if (!arquivo) { ignorados.push(`${req.nome}: não foi possível ler o arquivo "${doc.nome}".`); continue; }

      const ponto = (doc.arquivo_nome || "").lastIndexOf(".");
      const ext = ponto > 0 ? doc.arquivo_nome.slice(ponto) : ".pdf";
      let nome = `${String(incluidos.length + 1).padStart(2, "0")} - ${seguro(req.nome)}${ext}`;
      for (let n = 2; usados.has(nome); n++) nome = `${String(incluidos.length + 1).padStart(2, "0")} - ${seguro(req.nome)} (${n})${ext}`;
      usados.add(nome);
      arquivos[nome] = new Uint8Array(await arquivo.arrayBuffer());
      jaIncluidos.add(doc.id);
      incluidos.push(`${nome}  ←  "${doc.nome}"`);
    }

    const faltando = requisitos.filter((r) => !r.documentoId).map((r) => `${r.nome} (${r.status === "vencido" ? "vencido" : "não está no acervo"})`);
    const leiame = [
      `Documentos de habilitação — ${licitacao.orgao}`,
      `Licitação PNCP ${licitacao.numero_controle_pncp}`,
      `Gerado em ${new Date().toLocaleString("pt-BR")}`,
      "",
      `INCLUÍDOS (${incluidos.length}):`, ...(incluidos.length ? incluidos.map((l) => `  - ${l}`) : ["  (nenhum)"]),
      "",
      `NÃO INCLUÍDOS POR PROBLEMA (${ignorados.length}):`, ...(ignorados.length ? ignorados.map((l) => `  - ${l}`) : ["  (nenhum)"]),
      "",
      `AINDA FALTAM NO ACERVO (${faltando.length}):`, ...(faltando.length ? faltando.map((l) => `  - ${l}`) : ["  (nenhum)"]),
      "",
      "Confira o edital: este pacote segue a análise automática e não substitui a leitura dele.",
    ].join("\n");
    arquivos["LEIAME.txt"] = strToU8(leiame);

    if (incluidos.length === 0) {
      return NextResponse.json({ erro: "Nenhum documento em dia para este edital. Veja a lista de pendências na análise." }, { status: 404 });
    }
    const zip = zipSync(arquivos, { level: 0 }); // PDFs já são comprimidos
    const nomeZip = "Habilitacao_" + licitacao.numero_controle_pncp.replace(/[^0-9A-Za-z-]/g, "_") + ".zip";
    return new Response(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nomeZip}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ erro: error instanceof Error ? error.message : "Não foi possível montar o pacote." }, { status: 500 });
  }
}
