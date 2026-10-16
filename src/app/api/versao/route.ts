import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

/** Identificador da versão no ar: muda a cada build/deploy (a aba aberta compara com o que carregou). */
const VERSAO = (() => {
  try {
    return readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return String(Date.now()); // desenvolvimento: estável enquanto o servidor não reinicia
  }
})();

export function GET() {
  return Response.json({ versao: VERSAO }, { headers: { "Cache-Control": "no-store" } });
}
