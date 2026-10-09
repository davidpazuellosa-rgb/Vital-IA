import { NextRequest, NextResponse } from "next/server";
import { executarLembretes } from "@/lib/alertas/lembretes";

export const maxDuration = 60;

/**
 * Avisa (Telegram/e-mail) das propostas que encerram em breve e ainda não foram enviadas.
 * Protegida por CRON_SECRET, como /api/cron/alertas. Chamada a cada 30 min pelo cron da VPS:
 *   GET /api/cron/lembretes   com   Authorization: Bearer <CRON_SECRET>
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
    return NextResponse.json({ ok: true, ...(await executarLembretes()) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Erro ao executar lembretes." },
      { status: 500 },
    );
  }
}
