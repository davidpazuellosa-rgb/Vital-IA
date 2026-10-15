import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderizarPng } from "@/lib/vita/graficos/png";
import { validarSpec } from "@/lib/vita/graficos/tipos";

/** Imagem PNG (fixa) de um gráfico da Vita, para baixar. Recebe a especificação e desenha no servidor. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });
  const spec = validarSpec(await request.json().catch(() => null));
  if (!spec) return new Response("Gráfico inválido.", { status: 400 });
  const { png } = renderizarPng(spec, 1600);
  const nome = (spec.titulo || "grafico").replace(/[\\/:*?"<>|\r\n]+/g, " ").trim().slice(0, 80) || "grafico";
  return new Response(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="grafico.png"; filename*=UTF-8''${encodeURIComponent(nome)}.png`,
      "Cache-Control": "private, no-store",
    },
  });
}
