import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizarSnapshot } from "@/lib/vita/tela";
import { responderPedido } from "@/lib/vita/tela-ponte";

export const runtime = "nodejs";

/** O navegador devolve aqui o resultado de uma ação pedida pela Vita (clicar, preencher, navegar, ver). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const corpo = (await request.json().catch(() => ({}))) as { ok?: boolean; mensagem?: string; recusado?: boolean; pagina?: unknown };
  const ok = responderPedido(id, user.id, {
    ok: corpo.ok === true,
    mensagem: String(corpo.mensagem ?? "").slice(0, 400),
    recusado: corpo.recusado === true,
    pagina: sanitizarSnapshot(corpo.pagina) ?? undefined,
  });
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
