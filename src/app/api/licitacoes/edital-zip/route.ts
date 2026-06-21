import { NextRequest, NextResponse } from "next/server";
import { zip } from "fflate";
import { buscarArquivosPncp } from "@/lib/licitacoes/providers/pncp-arquivos";

function sanitizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_ ]/g, "_")
    .trim() || "arquivo";
}

export async function GET(request: NextRequest) {
  const numero = request.nextUrl.searchParams.get("n");
  if (!numero) {
    return NextResponse.json({ error: "Parâmetro 'n' obrigatório." }, { status: 400 });
  }

  const arquivos = await buscarArquivosPncp(numero);
  if (arquivos.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo de edital no PNCP." }, { status: 404 });
  }

  // Baixa todos os arquivos do PNCP em paralelo
  const baixados = await Promise.all(
    arquivos.map(async (a, i) => {
      try {
        const r = await fetch(a.url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
        if (!r.ok) return null;
        const bytes = new Uint8Array(await r.arrayBuffer());
        let nome = sanitizar(a.titulo);
        if (!/\.[a-z0-9]{2,4}$/i.test(nome)) nome += ".pdf";
        return { nome: `${String(i + 1).padStart(2, "0")} - ${nome}`, bytes };
      } catch {
        return null;
      }
    }),
  );

  const entradas: Record<string, Uint8Array> = {};
  for (const b of baixados) {
    if (b) entradas[b.nome] = b.bytes;
  }
  if (Object.keys(entradas).length === 0) {
    return NextResponse.json({ error: "Não foi possível baixar os arquivos do edital." }, { status: 502 });
  }

  // Zipa (store, sem recompressão — PDFs já são comprimidos)
  const zipped: Uint8Array = await new Promise((resolve, reject) => {
    zip(entradas, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)));
  });

  const nomeZip = `edital-${numero.replace(/[^\w]/g, "_")}.zip`;
  return new NextResponse(zipped as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${nomeZip}"`,
      "Content-Length": String(zipped.length),
    },
  });
}
