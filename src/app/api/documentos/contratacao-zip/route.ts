import { NextRequest } from "next/server";
import { zipSync } from "fflate";
import { createClient } from "@/lib/supabase/server";
import type { Contratacao, ClienteDocumento } from "@/lib/clientes/types";

/**
 * Exporta em um único ZIP todos os documentos de uma contratação (licitação
 * ganha dentro do cliente).
 *   GET /api/documentos/contratacao-zip?cid=<contratacaoId>
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

  const { data } = await supabase
    .from("cliente_documentos")
    .select("*")
    .eq("contratacao_id", cid)
    .order("created_at", { ascending: false });
  const documentos = (data ?? []) as ClienteDocumento[];
  if (documentos.length === 0) {
    return new Response("Nenhum documento nesta contratação.", { status: 404 });
  }

  const arquivos: Record<string, Uint8Array> = {};
  const usados = new Set<string>();
  for (const doc of documentos) {
    const { data: file } = await supabase.storage.from("documentos").download(doc.arquivo_path);
    if (!file) continue;

    // Nome único no ZIP (evita colisão entre arquivos com o mesmo nome).
    let nome = doc.arquivo_nome || `${doc.nome || doc.tipo}.pdf`;
    if (usados.has(nome)) {
      const p = nome.lastIndexOf(".");
      const base = p > 0 ? nome.slice(0, p) : nome;
      const ext = p > 0 ? nome.slice(p) : "";
      let i = 2;
      while (usados.has(`${base} (${i})${ext}`)) i++;
      nome = `${base} (${i})${ext}`;
    }
    usados.add(nome);
    arquivos[nome] = new Uint8Array(await file.arrayBuffer());
  }

  if (Object.keys(arquivos).length === 0) {
    return new Response("Não foi possível ler os arquivos.", { status: 502 });
  }

  const nomeZip =
    (ct.identificador || ct.titulo || "documentos")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9.\-_ ]/g, "_")
      .trim() || "documentos";

  const zip = zipSync(arquivos, { level: 0 }); // PDFs já são comprimidos → store é mais rápido
  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeZip}.zip"`,
    },
  });
}
