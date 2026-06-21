import { NextRequest, NextResponse } from "next/server";
import { executarAlertas } from "@/lib/alertas/executar";

export const maxDuration = 60;

/**
 * Executa os alertas (busca + notificação). Protegida por CRON_SECRET.
 * Chamar de hora em hora por um cron externo (ex.: cron-job.org):
 *   GET /api/cron/alertas?secret=SEU_SEGREDO
 * ou com header: Authorization: Bearer SEU_SEGREDO
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const fornecido =
    request.nextUrl.searchParams.get("secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || fornecido !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const resumo = await executarAlertas();
    return NextResponse.json({ ok: true, ...resumo });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Erro ao executar alertas." },
      { status: 500 },
    );
  }
}
