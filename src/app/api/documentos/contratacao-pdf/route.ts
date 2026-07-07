import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import type { Contratacao, ClienteDocumento } from "@/lib/clientes/types";

/**
 * Junta todos os documentos de uma contratação (licitação ganha) em um ÚNICO PDF.
 *   GET /api/documentos/contratacao-pdf?cid=<contratacaoId>
 * PDFs são incorporados página a página; imagens (PNG/JPG) viram uma página cada.
 * Arquivos não suportados (ou PDFs ilegíveis) são pulados.
 * A RLS do Supabase garante que só o dono acessa os arquivos.
 */
export async function GET(request: NextRequest) {
  const cid = request.nextUrl.searchParams.get("cid") ?? "";
  if (!cid) return new Response("Contratação não informada.", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const { data: cont } = await supabase.from("contratacoes").select("*").eq("id", cid).single();
  if (!cont) return new Response("Contratação não encontrada.", { status: 404 });
  const ct = cont as Contratacao;

  // Ordem cronológica (mais antigo primeiro) para leitura natural do PDF combinado.
  const { data } = await supabase
    .from("cliente_documentos")
    .select("*")
    .eq("contratacao_id", cid)
    .order("created_at", { ascending: true });
  const documentos = (data ?? []) as ClienteDocumento[];
  if (documentos.length === 0) {
    return new Response("Nenhum documento nesta contratação.", { status: 404 });
  }

  const merged = await PDFDocument.create();

  for (const doc of documentos) {
    const { data: file } = await supabase.storage.from("documentos").download(doc.arquivo_path);
    if (!file) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Sniff pelos bytes iniciais (não confia só na extensão).
    const ehPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
    const ehPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const ehJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

    try {
      if (ehPdf) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const paginas = await merged.copyPages(src, src.getPageIndices());
        paginas.forEach((p) => merged.addPage(p));
      } else if (ehPng || ehJpg) {
        const img = ehPng ? await merged.embedPng(bytes) : await merged.embedJpg(bytes);
        const pagina = merged.addPage([img.width, img.height]);
        pagina.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      // Outros formatos são ignorados (não há como colocá-los num PDF).
    } catch {
      /* pula documento ilegível/corrompido e segue */
    }
  }

  if (merged.getPageCount() === 0) {
    return new Response("Nenhum documento pôde ser combinado em PDF.", { status: 502 });
  }

  const nomeBase =
    (ct.identificador || ct.titulo || "documentos")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9.\-_ ]/g, "_")
      .trim() || "documentos";

  const pdf = await merged.save();
  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeBase}.pdf"`,
    },
  });
}
