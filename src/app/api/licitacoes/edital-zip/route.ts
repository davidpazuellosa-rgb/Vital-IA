import { NextRequest, NextResponse } from "next/server";
import { Zip, ZipPassThrough } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { buscarArquivosPncp, type ArquivoPncp } from "@/lib/licitacoes/providers/pncp-arquivos";
import { contentDispositionZip, nomeEdital } from "@/lib/licitacoes/nome-edital";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------------------------------------
 * ZIP com todos os arquivos do edital (PNCP).
 * O PNCP é LENTO para entregar arquivos (dezenas de segundos até o 1º byte). Por isso o ZIP é
 * enviado em FLUXO: os cabeçalhos HTTP saem na hora e cada arquivo vai para o navegador conforme
 * chega do PNCP (vários baixam em paralelo, a ordem do ZIP é mantida). Nada é guardado inteiro em
 * memória além dos arquivos "esperando a vez".
 *   GET ?n=<nº controle>&verificar=1  → confere rápido se há arquivos (JSON)
 *   GET ?n=<nº controle>              → o ZIP
 * ------------------------------------------------------------------------------------------- */

const PARALELO = 4;
const SEM_DADOS_MS = 90_000; // sem receber nem 1 byte por tanto tempo = desiste daquele arquivo

function sanitizar(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9.\-_ ]/g, "_").trim() || "arquivo";
}

function extensaoPorTipo(tipo: string | null): string {
  const t = (tipo ?? "").toLowerCase();
  if (t.includes("pdf")) return ".pdf";
  if (t.includes("wordprocessingml")) return ".docx";
  if (t.includes("msword")) return ".doc";
  if (t.includes("spreadsheetml")) return ".xlsx";
  if (t.includes("ms-excel")) return ".xls";
  if (t.includes("zip")) return ".zip";
  if (t.includes("png")) return ".png";
  if (t.includes("jpeg") || t.includes("jpg")) return ".jpg";
  if (t.includes("text/plain")) return ".txt";
  return ".pdf"; // editais são, na imensa maioria, PDF
}

type Tarefa = {
  arquivo: ArquivoPncp;
  indice: number;
  controle: AbortController;
  cabecalhos: Promise<{ ok: boolean; tipo: string | null; motivo?: string }>;
  fila: Uint8Array[];
  fim: boolean;
  erro: string | null;
  acordar: (() => void) | null;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const numero = request.nextUrl.searchParams.get("n");
  if (!numero) return NextResponse.json({ error: "Parâmetro 'n' obrigatório." }, { status: 400 });

  let arquivos: ArquivoPncp[];
  try {
    arquivos = await buscarArquivosPncp(numero);
  } catch {
    return NextResponse.json({ error: "O PNCP não respondeu agora. Tente de novo em instantes." }, { status: 502 });
  }
  if (arquivos.length === 0) return NextResponse.json({ error: "Nenhum arquivo de edital no PNCP." }, { status: 404 });
  if (request.nextUrl.searchParams.get("verificar")) return NextResponse.json({ ok: true, total: arquivos.length });

  const geral = new AbortController();
  request.signal.addEventListener("abort", () => geral.abort());

  // ---- downloads (até PARALELO ao mesmo tempo), cada um alimentando a sua fila ----
  const tarefas: Tarefa[] = arquivos.map((arquivo, indice) => {
    let resolver!: (v: { ok: boolean; tipo: string | null; motivo?: string }) => void;
    const t: Tarefa = {
      arquivo, indice, controle: new AbortController(), fila: [], fim: false, erro: null, acordar: null,
      cabecalhos: new Promise((r) => { resolver = r; }),
    };
    (t as Tarefa & { resolver: typeof resolver }).resolver = resolver;
    return t;
  });

  async function baixar(t: Tarefa) {
    const resolver = (t as Tarefa & { resolver: (v: { ok: boolean; tipo: string | null; motivo?: string }) => void }).resolver;
    let cabecalhosEnviados = false;
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const armar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(() => t.controle.abort(), SEM_DADOS_MS);
    };
    const parar = () => t.controle.abort();
    geral.signal.addEventListener("abort", parar);
    try {
      armar();
      const r = await fetch(t.arquivo.url, { cache: "no-store", signal: t.controle.signal });
      if (!r.ok || !r.body) {
        resolver({ ok: false, tipo: null, motivo: `PNCP respondeu ${r.status}` });
        cabecalhosEnviados = true;
        return;
      }
      resolver({ ok: true, tipo: r.headers.get("content-type") });
      cabecalhosEnviados = true;
      const leitor = r.body.getReader();
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        armar();
        t.fila.push(value);
        t.acordar?.();
      }
    } catch {
      t.erro = geral.signal.aborted ? "download cancelado" : "o PNCP parou de enviar";
      if (!cabecalhosEnviados) resolver({ ok: false, tipo: null, motivo: t.erro });
    } finally {
      clearTimeout(relogio);
      geral.signal.removeEventListener("abort", parar);
      t.fim = true;
      t.acordar?.();
    }
  }

  let proximo = 0;
  async function operario() {
    while (proximo < tarefas.length && !geral.signal.aborted) await baixar(tarefas[proximo++]);
  }
  void Promise.all(Array.from({ length: Math.min(PARALELO, tarefas.length) }, operario));

  // ---- ZIP em fluxo, na ordem dos arquivos ----
  const texto = new TextEncoder();
  const corpo = new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((erro, pedaco, final) => {
        if (erro) { controller.error(erro); return; }
        controller.enqueue(pedaco);
        if (final) controller.close();
      });
      const falhas: string[] = [];
      try {
        for (const t of tarefas) {
          if (geral.signal.aborted) break;
          const cab = await t.cabecalhos;
          const rotulo = t.arquivo.titulo;
          if (!cab.ok) { falhas.push(`${rotulo}: ${cab.motivo ?? "não foi possível baixar"}`); continue; }
          let base = sanitizar(t.arquivo.titulo);
          if (!/\.[a-z0-9]{2,4}$/i.test(base)) base += extensaoPorTipo(cab.tipo);
          const entrada = new ZipPassThrough(`${String(t.indice + 1).padStart(2, "0")} - ${base}`);
          zip.add(entrada);
          for (;;) {
            while (t.fila.length) entrada.push(t.fila.shift()!, false);
            if (t.fim) break;
            await new Promise<void>((acordado) => { t.acordar = acordado; });
          }
          entrada.push(new Uint8Array(0), true);
          if (t.erro) falhas.push(`${rotulo}: arquivo incompleto (${t.erro}). Baixe-o direto no PNCP.`);
        }
        if (falhas.length) {
          const leiame = new ZipPassThrough("LEIAME.txt");
          zip.add(leiame);
          leiame.push(texto.encode(`Alguns arquivos do edital não puderam ser baixados agora (o PNCP está lento ou instável):\r\n\r\n${falhas.map((f) => `- ${f}`).join("\r\n")}\r\n\r\nTente de novo mais tarde ou baixe-os direto em https://pncp.gov.br.\r\n`), true);
        }
        zip.end();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() {
      geral.abort();
    },
  });

  // Nome: "Cidade-objeto resumido" (dados da licitação salva); sem ela, o nº de controle.
  const { data: salva } = await supabase
    .from("saved_licitacoes")
    .select("municipio, uf, titulo, orgao")
    .eq("numero_controle_pncp", numero)
    .limit(1)
    .maybeSingle();
  const nomeZip = nomeEdital(salva ?? {}, numero);
  return new Response(corpo, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDispositionZip(nomeZip),
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
