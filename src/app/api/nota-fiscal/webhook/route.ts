import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { consultarNFe } from "@/lib/nota-fiscal/engine";

/**
 * Webhook do provedor (Focus NFe). Configure a URL no painel do provedor como:
 *   https://SEU_DOMINIO/api/nota-fiscal/webhook?secret=FOCUS_NFE_WEBHOOK_SECRET
 * Ao receber, reconsulta o provedor pela `ref` (fonte autoritativa) e atualiza a nota.
 */
function extrairRef(body: unknown): string | null {
  if (!body) return null;
  if (Array.isArray(body)) {
    for (const item of body) {
      const r = extrairRef(item);
      if (r) return r;
    }
    return null;
  }
  if (typeof body === "object" && "ref" in body) {
    const r = (body as { ref?: unknown }).ref;
    return typeof r === "string" && r ? r : null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.FOCUS_NFE_WEBHOOK_SECRET;
  const fornecido =
    request.nextUrl.searchParams.get("secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || fornecido !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ref = extrairRef(body);
  if (!ref) {
    // Sem ref reconhecível: nada a fazer, mas responde 200 para o provedor não reenviar.
    return NextResponse.json({ ok: true, ignorado: "sem ref" });
  }

  const supabase = createServiceClient();
  const { data: notas, error: selErr } = await supabase
    .from("notas_fiscais")
    .select("id, status, ref, chave, protocolo")
    .eq("ref", ref);
  if (selErr) {
    return NextResponse.json({ ok: false, error: selErr.message }, { status: 500 });
  }
  // Só avança notas realmente enviadas (em processamento). Nunca toca em rascunho
  // ou em notas já em estado terminal, e escopa o update pela primary key (não pela ref).
  const alvos = (notas ?? []).filter((n) => n.status === "processando");
  if (alvos.length === 0) {
    return NextResponse.json({ ok: true, ignorado: "sem nota em processamento para esta ref" });
  }
  const alvo = alvos[0];

  let resultado;
  try {
    resultado = await consultarNFe({
      ref: alvo.ref,
      chave: alvo.chave ?? "",
      protocolo: alvo.protocolo ?? "",
    });
  } catch (e) {
    // Falha transitória ao consultar — 502 sinaliza ao provedor para reenviar depois.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Falha ao consultar." },
      { status: 502 },
    );
  }

  // Não sobrescreve numero/série/links com vazio caso a consulta ainda não os traga.
  const patch: Record<string, unknown> = {
    status: resultado.status,
    motivo_rejeicao: resultado.motivo,
    updated_at: new Date().toISOString(),
  };
  if (resultado.numero) patch.numero = resultado.numero;
  if (resultado.serie) patch.serie = resultado.serie;
  if (resultado.danfeUrl) patch.danfe_url = resultado.danfeUrl;
  if (resultado.xmlUrl) patch.xml_url = resultado.xmlUrl;

  for (const nota of alvos) {
    const { error } = await supabase.from("notas_fiscais").update(patch).eq("id", nota.id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, ref, status: resultado.status });
}
