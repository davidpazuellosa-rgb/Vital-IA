import { NextRequest } from "next/server";
import { zipSync } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { GRUPOS_DOCUMENTOS, type Documento } from "@/lib/documentos/types";

/**
 * Exporta em um único ZIP todos os documentos de um grupo do checklist.
 *   GET /api/documentos/exportar?grupo=<slug>
 * Ex.: ?grupo=fiscal_trabalhista → Regularidade Fiscal e Trabalhista.
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("grupo") ?? "";
  const grupo = GRUPOS_DOCUMENTOS.find((g) => g.slug === slug);
  if (!grupo) return new Response("Grupo não encontrado.", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const tipos = grupo.tipos.map((t) => t.slug);
  const { data } = await supabase.from("documentos").select("*").in("tipo", tipos);
  const documentos = (data ?? []) as Documento[];
  if (documentos.length === 0) {
    return new Response("Nenhum documento neste grupo.", { status: 404 });
  }

  const arquivos: Record<string, Uint8Array> = {};
  const usados = new Set<string>();
  for (const doc of documentos) {
    const { data: file } = await supabase.storage.from("documentos").download(doc.arquivo_path);
    if (!file) continue;

    // Nome único no ZIP (evita colisão entre arquivos com o mesmo nome).
    let nome = doc.arquivo_nome || `${doc.tipo}.pdf`;
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

  const zip = zipSync(arquivos, { level: 0 }); // PDFs já são comprimidos → store é mais rápido
  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${grupo.slug}.zip"`,
    },
  });
}
