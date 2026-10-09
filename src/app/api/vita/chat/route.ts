import { NextRequest } from "next/server";
import type { UnifiedLicitacao } from "@/lib/licitacoes/types";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { createClient } from "@/lib/supabase/server";
import { blocoAnexos, lerAnexo, MAX_ANEXOS, MAX_BYTES_ANEXO, type AnexoEnviado, type AnexoLido } from "@/lib/vita/anexos";
import { instrucoesVita } from "@/lib/vita/contexto";
import { executarFerramenta, FERRAMENTAS, ROTULO_FERRAMENTA, type ContextoFerramenta } from "@/lib/vita/ferramentas";

export const runtime = "nodejs";
export const maxDuration = 180;

const DEEPSEEK = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "") + "/chat/completions";
const MODELO = process.env.VITA_MODELO || process.env.DEEPSEEK_MODEL_FLASH || "deepseek-flash";
const MAX_RODADAS = 6;           // rodadas de ferramentas por mensagem
const HISTORICO = 40;            // mensagens anteriores enviadas ao modelo
const LIMITE_RESULTADO = 6_000;  // caracteres guardados por resultado de ferramenta

type ChamadaFerramenta = { id: string; type: "function"; function: { name: string; arguments: string } };
type ParteConteudo = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
type MensagemModelo =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ParteConteudo[] }
  | { role: "assistant"; content: string; tool_calls?: ChamadaFerramenta[] }
  | { role: "tool"; tool_call_id: string; content: string };

/** Uma rodada no DeepSeek em streaming: repassa o texto ao vivo e devolve as ferramentas pedidas. */
async function rodadaModelo(
  mensagens: MensagemModelo[],
  sinal: AbortSignal,
  aoTexto: (delta: string) => void,
): Promise<{ texto: string; chamadas: ChamadaFerramenta[] }> {
  const chave = process.env.DEEPSEEK_API_KEY?.trim();
  if (!chave) throw new Error("A IA não está configurada (DEEPSEEK_API_KEY).");
  const res = await fetch(DEEPSEEK, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELO,
      messages: mensagens,
      tools: FERRAMENTAS,
      thinking: { type: "disabled" },
      temperature: 0.3,
      max_tokens: 4_000,
      stream: true,
    }),
    signal: AbortSignal.any([sinal, AbortSignal.timeout(120_000)]),
  });
  if (!res.ok || !res.body) {
    const detalhe = (await res.text().catch(() => "")).slice(0, 200);
    throw new Error(res.status === 429 ? "A IA está sobrecarregada agora. Tente de novo em instantes." : `A IA respondeu ${res.status}. ${detalhe}`);
  }

  const leitor = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  let texto = "";
  const parciais: Array<{ id: string; name: string; args: string }> = [];

  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const linhas = buffer.split("\n");
    buffer = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (!linha.startsWith("data: ")) continue;
      const dado = linha.slice(6).trim();
      if (!dado || dado === "[DONE]") continue;
      let evento: { choices?: Array<{ delta?: { content?: string | null; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } }> };
      try { evento = JSON.parse(dado); } catch { continue; }
      const delta = evento.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) { texto += delta.content; aoTexto(delta.content); }
      for (const tc of delta.tool_calls ?? []) {
        const p = (parciais[tc.index] ??= { id: "", name: "", args: "" });
        if (tc.id) p.id = tc.id;
        if (tc.function?.name) p.name += tc.function.name;
        if (tc.function?.arguments) p.args += tc.function.arguments;
      }
    }
  }
  const chamadas = parciais.filter(Boolean).map((p, i) => ({
    id: p.id || `chamada_${i}`,
    type: "function" as const,
    function: { name: p.name, arguments: p.args || "{}" },
  }));
  return { texto, chamadas };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autenticado.", { status: 401 });

  const corpo = (await request.json().catch(() => ({}))) as {
    conversaId?: string; mensagem?: string; pagina?: string; anexos?: AnexoEnviado[];
  };
  const anexos = Array.isArray(corpo.anexos) ? corpo.anexos : [];
  if (anexos.length > MAX_ANEXOS) return new Response(`No máximo ${MAX_ANEXOS} anexos por mensagem.`, { status: 400 });
  const empresaUserId = await resolverEmpresaUserId(supabase, user.id);
  for (const a of anexos) {
    // Só arquivos que o próprio usuário enviou para a pasta da Vita da empresa.
    if (typeof a?.path !== "string" || !a.path.startsWith(`${empresaUserId}/vita/`) || a.path.includes("..")) {
      return new Response("Anexo inválido.", { status: 400 });
    }
    if (Number(a.tamanho) > MAX_BYTES_ANEXO) return new Response(`"${a.nome}" passa de 20 MB.`, { status: 400 });
  }
  const mensagem = String(corpo.mensagem ?? "").trim() || (anexos.length ? "Analise o(s) arquivo(s) anexado(s)." : "");
  if (!mensagem) return new Response("Mensagem vazia.", { status: 400 });
  if (mensagem.length > 8_000) return new Response("Mensagem longa demais (máx. 8.000 caracteres).", { status: 400 });

  // Conversa existente (do próprio usuário — garantido pelo RLS) ou nova.
  let conversaId = corpo.conversaId ?? null;
  let vistas: Record<string, UnifiedLicitacao> = {};
  let titulo = "";
  if (conversaId) {
    const { data } = await supabase.from("vita_conversas").select("id, titulo, dados").eq("id", conversaId).maybeSingle();
    if (!data) return new Response("Conversa não encontrada.", { status: 404 });
    vistas = ((data.dados as { vistas?: Record<string, UnifiedLicitacao> })?.vistas) ?? {};
    titulo = data.titulo;
  } else {
    titulo = mensagem.replace(/\s+/g, " ").slice(0, 60) + (mensagem.length > 60 ? "…" : "");
    const { data, error } = await supabase.from("vita_conversas").insert({ user_id: user.id, titulo }).select("id").single();
    if (error || !data) return new Response("Não foi possível criar a conversa.", { status: 500 });
    conversaId = data.id as string;
  }

  const { data: anteriores } = await supabase
    .from("vita_mensagens")
    .select("papel, conteudo, dados")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: false })
    .limit(HISTORICO);

  const historico: MensagemModelo[] = [];
  for (const m of (anteriores ?? []).reverse()) {
    if (m.papel === "user") {
      const anexosSalvos = ((m.dados as { anexos?: Array<AnexoLido & { tamanho?: number }> })?.anexos) ?? [];
      const reproduzidos = anexosSalvos.map((a) =>
        a.tipo === "imagem" ? { ...a, texto: "(imagem enviada antes nesta conversa; a análise está na resposta seguinte)" } : a);
      historico.push({ role: "user", content: m.conteudo + blocoAnexos(reproduzidos) });
    }
    else if (m.papel === "evento") historico.push({ role: "system", content: m.conteudo });
    else {
      const protocolo = (m.dados as { protocolo?: MensagemModelo[] })?.protocolo;
      if (Array.isArray(protocolo) && protocolo.length) historico.push(...protocolo);
      else historico.push({ role: "assistant", content: m.conteudo });
    }
  }
  const sistema = await instrucoesVita(supabase, String(corpo.pagina ?? ""));
  const base: MensagemModelo[] = [{ role: "system", content: sistema }, ...historico];

  const ctx: ContextoFerramenta = { supabase, userId: user.id, vistas };
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (evento: Record<string, unknown>) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(evento)}\n\n`)); } catch { /* cliente saiu */ }
      };
      enviar({ tipo: "conversa", id: conversaId, titulo });

      // Lê os anexos (mostrando o progresso) e monta a mensagem atual para o modelo.
      const lidos: AnexoLido[] = [];
      for (const [i, a] of anexos.entries()) {
        const idEv = `anexo_${i}`;
        enviar({ tipo: "ferramenta", id: idEv, nome: "ler_anexo", rotulo: `Lendo ${a.nome}`, estado: "inicio" });
        lidos.push(await lerAnexo(supabase, { path: a.path, nome: String(a.nome), tamanho: Number(a.tamanho), mime: String(a.mime ?? "") }));
        enviar({ tipo: "ferramenta", id: idEv, nome: "ler_anexo", rotulo: `Lendo ${a.nome}`, estado: "fim" });
      }
      const textoAtual = mensagem + blocoAnexos(lidos);
      const imagens = lidos.filter((a) => a.imagem);
      base.push({
        role: "user",
        content: imagens.length
          ? [{ type: "text", text: textoAtual }, ...imagens.map((a) => ({ type: "image_url" as const, image_url: { url: a.imagem! } }))]
          : textoAtual,
      });
      await supabase.from("vita_mensagens").insert({
        conversa_id: conversaId, user_id: user.id, papel: "user", conteudo: mensagem,
        dados: lidos.length
          ? { anexos: lidos.map((a, i) => ({ nome: a.nome, path: a.path, tipo: a.tipo, tamanho: Number(anexos[i].tamanho), observacao: a.observacao ?? null, texto: a.texto.slice(0, 20_000) })) }
          : {},
      });

      const protocolo: MensagemModelo[] = [];
      const ferramentasUsadas: Array<{ nome: string; rotulo: string }> = [];
      const acoesCriadas: string[] = [];
      let textoFinal = "";
      let erro: string | null = null;

      try {
        for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
          const { texto, chamadas } = await rodadaModelo([...base, ...protocolo], request.signal, (d) => {
            textoFinal += d;
            enviar({ tipo: "texto", delta: d });
          });
          if (!chamadas.length) {
            protocolo.push({ role: "assistant", content: texto });
            break;
          }
          protocolo.push({ role: "assistant", content: texto, tool_calls: chamadas });
          for (const c of chamadas) {
            const rotulo = ROTULO_FERRAMENTA[c.function.name] ?? c.function.name;
            enviar({ tipo: "ferramenta", id: c.id, nome: c.function.name, rotulo, estado: "inicio" });
            const r = await executarFerramenta(c.function.name, c.function.arguments, ctx);
            if (r.acao) {
              const { data: acao } = await supabase
                .from("vita_acoes")
                .insert({
                  conversa_id: conversaId, user_id: user.id, tipo: r.acao.tipo, parametros: r.acao.parametros,
                  resumo: r.acao.resumo, detalhes: r.acao.detalhes, aviso: r.acao.aviso ?? null,
                })
                .select("id, tipo, resumo, detalhes, aviso, status")
                .single();
              if (acao) {
                acoesCriadas.push(acao.id as string);
                enviar({ tipo: "acao", acao });
              }
            }
            ferramentasUsadas.push({ nome: c.function.name, rotulo });
            enviar({ tipo: "ferramenta", id: c.id, nome: c.function.name, rotulo, estado: "fim" });
            protocolo.push({ role: "tool", tool_call_id: c.id, content: r.paraModelo.slice(0, LIMITE_RESULTADO) });
          }
          if (textoFinal && !textoFinal.endsWith("\n")) { textoFinal += "\n\n"; enviar({ tipo: "texto", delta: "\n\n" }); }
        }
      } catch (e) {
        if (!request.signal.aborted) erro = e instanceof Error ? e.message : "Falha ao falar com a IA.";
      }

      if (erro) enviar({ tipo: "erro", mensagem: erro });
      const conteudo = textoFinal.trim() || (erro ? "" : "(sem resposta)");
      const { data: salva } = await supabase
        .from("vita_mensagens")
        .insert({
          conversa_id: conversaId, user_id: user.id, papel: "assistant",
          conteudo: erro && !conteudo ? `⚠️ ${erro}` : conteudo,
          dados: { protocolo, ferramentas: ferramentasUsadas, acoes: acoesCriadas, ...(erro ? { erro } : {}) },
        })
        .select("id")
        .single();
      // Guarda só as licitações mais recentes vistas (para salvar sem consultar o PNCP de novo).
      const vistasRecentes = Object.fromEntries(Object.entries(ctx.vistas).slice(-150));
      await supabase.from("vita_conversas").update({ updated_at: new Date().toISOString(), dados: { vistas: vistasRecentes } }).eq("id", conversaId);
      enviar({ tipo: "fim", mensagemId: salva?.id ?? null });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
