import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { MIME } from "@/lib/vita/arquivos/modelo";

/** Baixa um arquivo que a Vita gerou (planilha, PDF ou Word). Só da pasta da empresa do usuário. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const caminho = request.nextUrl.searchParams.get("p") ?? "";
  const dono = await resolverEmpresaUserId(supabase, user.id);
  if (!caminho.startsWith(`${dono}/vita/gerados/`) || caminho.includes("..")) return new Response("Arquivo inválido.", { status: 400 });

  const { data, error } = await supabase.storage.from("documentos").download(caminho);
  if (error || !data) return new Response("Arquivo não encontrado.", { status: 404 });

  const ext = (caminho.split(".").pop() ?? "").toLowerCase() as keyof typeof MIME;
  const pedido = (request.nextUrl.searchParams.get("n") ?? "").replace(/[\\/:*?"<>|\r\n]+/g, " ").trim().slice(0, 120);
  const nome = pedido || `arquivo.${ext}`;
  return new Response(await data.arrayBuffer(), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${nome.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
