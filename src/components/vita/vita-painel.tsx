"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  ArrowUp, Check, CheckCircle2, History, Loader2, MessageSquarePlus, Search, ShieldCheck, Sparkles, Square, Trash2, X, XCircle, AlertTriangle,
  Paperclip, FileText, FileSpreadsheet, ImageIcon, File as FileIcon, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { obterEmpresaUserId } from "@/lib/documentos/actions";
import { createClient } from "@/lib/supabase/client";
import { ACEITOS, MAX_ANEXOS, motivoRecusa, tipoDoArquivo, type TipoAnexo } from "@/lib/vita/anexos-regras";
import { apagarConversa, carregarConversa, listarConversas, type AcaoVita, type AnexoExibido, type ResumoConversa } from "@/lib/vita/conversas";
import { cn } from "@/lib/utils";
import { LARGURA_MAX, LARGURA_MIN, useVita } from "./vita-contexto";

type Ferramenta = { id?: string; nome: string; rotulo: string; estado: "rodando" | "ok" };
type Msg = {
  id: string;
  papel: "user" | "assistant";
  conteudo: string;
  ferramentas: Ferramenta[];
  acoes: string[];
  anexos: AnexoExibido[];
  erro?: string;
  transmitindo?: boolean;
};

type AnexoLocal = {
  id: string;
  nome: string;
  tamanho: number;
  mime: string;
  tipo: TipoAnexo;
  estado: "enviando" | "pronto" | "erro";
  path?: string;
  erro?: string;
};

const sanitizar = (n: string) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100) || "arquivo";
const tamanhoLegivel = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);
const ICONE_ANEXO: Record<string, typeof FileIcon> = { pdf: FileText, imagem: ImageIcon, planilha: FileSpreadsheet, documento: FileText, texto: FileText };

/** Fotos grandes são reduzidas no navegador (lado maior 2000 px, JPEG): envio mais rápido e leitura por IA mais barata. */
async function prepararImagem(arquivo: File): Promise<{ blob: Blob; nome: string; mime: string }> {
  const original = { blob: arquivo as Blob, nome: arquivo.name, mime: arquivo.type || "image/jpeg" };
  const heic = /heic|heif/i.test(arquivo.type + arquivo.name);
  if (arquivo.type === "image/gif" || (!heic && arquivo.size < 1.5 * 1024 * 1024)) return original;
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return original;
    return { blob, nome: arquivo.name.replace(/\.[^.]+$/, "") + ".jpg", mime: "image/jpeg" };
  } catch {
    return original; // navegador não decodifica (ex.: HEIC no Chrome): vai o original e a Vita avisa
  }
}

const SUGESTOES = [
  "Busque pregões de gêneros alimentícios abertos no Amazonas",
  "Anexe uma tabela de preços ou uma certidão e eu leio para você",
  "Algum documento meu está vencido ou vencendo?",
  "Quais licitações salvas encerram nos próximos 7 dias?",
  "Me resuma os dados da minha empresa",
];

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()));
const CONVERSA_KEY = "vitalia:vita:conversa";

export function VitaPainel() {
  const { aberto, largura, pronto, fechar, definirLargura } = useVita();
  const [arrastando, setArrastando] = useState(false);

  // Redimensionar arrastando a borda esquerda
  const iniciarArraste = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setArrastando(true);
    const mover = (ev: PointerEvent) => definirLargura(window.innerWidth - ev.clientX);
    const soltar = () => {
      setArrastando(false);
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  }, [definirLargura]);

  return (
    <aside
      aria-label="Vita, assistente de IA"
      aria-hidden={!aberto}
      inert={!aberto}
      style={{ "--vita-w": `${aberto ? largura : 0}px`, "--vita-largura": `${largura}px` } as React.CSSProperties}
      className={cn(
        "z-40 shrink-0 overflow-hidden bg-background",
        // Desktop: ocupa espaço na linha e empurra a página (anima a largura).
        "md:sticky md:top-0 md:h-svh md:w-(--vita-w) md:border-l",
        // Celular: tela cheia, desliza da direita.
        "max-md:fixed max-md:inset-0 max-md:w-full",
        aberto ? "max-md:translate-x-0" : "max-md:translate-x-full",
        pronto && !arrastando && "transition-[width,translate] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        !aberto && "md:border-l-0",
      )}
    >
      {/* Alça para redimensionar */}
      <div
        onPointerDown={iniciarArraste}
        role="separator"
        aria-orientation="vertical"
        aria-valuemin={LARGURA_MIN}
        aria-valuemax={LARGURA_MAX}
        aria-valuenow={largura}
        title="Arraste para ajustar a largura"
        className="absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize transition-colors hover:bg-primary/30 md:block"
      />
      <div
        className={cn(
          "flex h-full w-full flex-col md:w-(--vita-largura)",
          pronto && "transition-[opacity,translate] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          aberto ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0",
        )}
      >
        <Conversa aberto={aberto} onFechar={fechar} />
      </div>
    </aside>
  );
}

function Conversa({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [acoes, setAcoes] = useState<Record<string, AcaoVita>>({});
  const [entrada, setEntrada] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const abortar = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const seletor = useRef<HTMLInputElement>(null);
  const empresaId = useRef<string | null>(null);
  const [anexos, setAnexos] = useState<AnexoLocal[]>([]);
  const [arrastandoArquivo, setArrastandoArquivo] = useState(false);
  const enviandoAnexo = anexos.some((a) => a.estado === "enviando");
  const anexosProntos = anexos.filter((a) => a.estado === "pronto");

  async function adicionarArquivos(lista: File[]) {
    const vagas = MAX_ANEXOS - anexos.length;
    if (lista.length > vagas) toast.error(`No máximo ${MAX_ANEXOS} arquivos por mensagem.`, { description: vagas > 0 ? `Só ${vagas} foram adicionados.` : undefined });
    for (const arquivo of lista.slice(0, Math.max(0, vagas))) {
      const recusa = motivoRecusa(arquivo);
      if (recusa) { toast.error(arquivo.name, { description: recusa }); continue; }
      const id = novoId();
      const tipo = tipoDoArquivo(arquivo.name, arquivo.type);
      setAnexos((l) => [...l, { id, nome: arquivo.name, tamanho: arquivo.size, mime: arquivo.type, tipo, estado: "enviando" }]);
      void (async () => {
        try {
          const preparado = tipo === "imagem" ? await prepararImagem(arquivo) : { blob: arquivo as Blob, nome: arquivo.name, mime: arquivo.type || "application/octet-stream" };
          empresaId.current ??= await obterEmpresaUserId();
          const path = `${empresaId.current}/vita/${new Date().toISOString().slice(0, 7)}/${id}-${sanitizar(preparado.nome)}`;
          const { error } = await createClient().storage.from("documentos").upload(path, preparado.blob, { contentType: preparado.mime, upsert: false });
          if (error) throw new Error(error.message);
          setAnexos((l) => l.map((a) => (a.id === id ? { ...a, estado: "pronto", path, nome: preparado.nome, mime: preparado.mime, tamanho: preparado.blob.size } : a)));
        } catch (e) {
          setAnexos((l) => l.map((a) => (a.id === id ? { ...a, estado: "erro", erro: e instanceof Error ? e.message : "Falha no envio" } : a)));
        }
      })();
    }
  }

  // Arrastar arquivos para QUALQUER lugar da tela manda para a Vita (e abre o painel se estiver fechado).
  const { abrir } = useVita();
  const adicionarRef = useRef(adicionarArquivos);
  useEffect(() => { adicionarRef.current = adicionarArquivos; });
  useEffect(() => {
    let profundidade = 0;
    const temArquivos = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const entrar = (e: DragEvent) => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      profundidade += 1;
      setArrastandoArquivo(true);
    };
    const sobre = (e: DragEvent) => {
      if (!temArquivos(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const sair = (e: DragEvent) => {
      if (!temArquivos(e)) return;
      profundidade = Math.max(0, profundidade - 1);
      if (profundidade === 0) setArrastandoArquivo(false);
    };
    const soltar = (e: DragEvent) => {
      profundidade = 0;
      setArrastandoArquivo(false);
      if (!temArquivos(e) || e.defaultPrevented) return;
      e.preventDefault();
      const arquivos = Array.from(e.dataTransfer?.files ?? []);
      if (!arquivos.length) return;
      abrir();
      void adicionarRef.current(arquivos);
    };
    const cancelar = () => { profundidade = 0; setArrastandoArquivo(false); };
    window.addEventListener("dragenter", entrar);
    window.addEventListener("dragover", sobre);
    window.addEventListener("dragleave", sair);
    window.addEventListener("drop", soltar);
    window.addEventListener("dragend", cancelar);
    return () => {
      window.removeEventListener("dragenter", entrar);
      window.removeEventListener("dragover", sobre);
      window.removeEventListener("dragleave", sair);
      window.removeEventListener("drop", soltar);
      window.removeEventListener("dragend", cancelar);
    };
  }, [abrir]);

  function removerAnexo(id: string) {
    const a = anexos.find((x) => x.id === id);
    setAnexos((l) => l.filter((x) => x.id !== id));
    if (a?.path) void createClient().storage.from("documentos").remove([a.path]);
  }

  const abrirConversa = useCallback(async (id: string) => {
    setCarregando(true);
    try {
      const r = await carregarConversa(id);
      setConversaId(id);
      setMensagens(r.mensagens.map((m) => ({ ...m, ferramentas: m.ferramentas.map((f) => ({ ...f, estado: "ok" as const })) })));
      setAcoes(r.acoes);
      try { localStorage.setItem(CONVERSA_KEY, id); } catch { /* ignora */ }
    } catch {
      setConversaId(null);
      setMensagens([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Retoma a última conversa
  useEffect(() => {
    let id: string | null = null;
    try { id = localStorage.getItem(CONVERSA_KEY); } catch { /* ignora */ }
    if (id) void abrirConversa(id);
  }, [abrirConversa]);

  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [mensagens, acoes]);
  useEffect(() => { if (aberto) setTimeout(() => campo.current?.focus(), 350); }, [aberto]);

  function novaConversa() {
    abortar.current?.abort();
    setConversaId(null);
    setMensagens([]);
    setAcoes({});
    try { localStorage.removeItem(CONVERSA_KEY); } catch { /* ignora */ }
    campo.current?.focus();
  }

  function atualizarUltima(mudar: (m: Msg) => Msg) {
    setMensagens((lista) => {
      const i = lista.length - 1;
      if (i < 0 || lista[i].papel !== "assistant") return lista;
      const copia = lista.slice();
      copia[i] = mudar(copia[i]);
      return copia;
    });
  }

  async function enviar(textoBruto?: string) {
    const texto = (textoBruto ?? entrada).trim();
    const paraEnviar = textoBruto ? [] : anexosProntos;
    if ((!texto && !paraEnviar.length) || enviando || enviandoAnexo) return;
    setEntrada("");
    if (!textoBruto) setAnexos([]);
    setEnviando(true);
    setMensagens((l) => [
      ...l,
      { id: novoId(), papel: "user", conteudo: texto, ferramentas: [], acoes: [], anexos: paraEnviar.map((a) => ({ nome: a.nome, tipo: a.tipo })) },
      { id: novoId(), papel: "assistant", conteudo: "", ferramentas: [], acoes: [], anexos: [], transmitindo: true },
    ]);
    const controle = new AbortController();
    abortar.current = controle;
    try {
      const res = await fetch("/api/vita/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversaId, mensagem: texto, pagina: pathname,
          anexos: paraEnviar.map((a) => ({ path: a.path, nome: a.nome, tamanho: a.tamanho, mime: a.mime })),
        }),
        signal: controle.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `Erro ${res.status}`);
      const leitor = res.body.getReader();
      const dec = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const partes = buffer.split("\n\n");
        buffer = partes.pop() ?? "";
        for (const parte of partes) {
          if (!parte.startsWith("data: ")) continue;
          const ev = JSON.parse(parte.slice(6)) as Record<string, unknown>;
          switch (ev.tipo) {
            case "conversa":
              setConversaId(String(ev.id));
              try { localStorage.setItem(CONVERSA_KEY, String(ev.id)); } catch { /* ignora */ }
              break;
            case "texto":
              atualizarUltima((m) => ({ ...m, conteudo: m.conteudo + String(ev.delta) }));
              break;
            case "ferramenta":
              atualizarUltima((m) =>
                ev.estado === "inicio"
                  ? { ...m, ferramentas: [...m.ferramentas, { id: String(ev.id), nome: String(ev.nome), rotulo: String(ev.rotulo), estado: "rodando" }] }
                  : { ...m, ferramentas: m.ferramentas.map((f) => (f.id === ev.id ? { ...f, estado: "ok" } : f)) },
              );
              break;
            case "acao": {
              const acao = ev.acao as AcaoVita;
              setAcoes((a) => ({ ...a, [acao.id]: { ...acao, resultado: null } }));
              atualizarUltima((m) => ({ ...m, acoes: [...m.acoes, acao.id] }));
              break;
            }
            case "erro":
              atualizarUltima((m) => ({ ...m, erro: String(ev.mensagem) }));
              break;
            case "fim":
              atualizarUltima((m) => ({ ...m, id: String(ev.mensagemId ?? m.id), transmitindo: false }));
              break;
          }
        }
      }
    } catch (e) {
      if (!controle.signal.aborted) atualizarUltima((m) => ({ ...m, erro: e instanceof Error ? e.message : "Falha ao falar com a Vita." }));
    } finally {
      atualizarUltima((m) => ({ ...m, transmitindo: false }));
      setEnviando(false);
      abortar.current = null;
    }
  }

  async function decidir(id: string, decisao: "aprovar" | "recusar") {
    setAcoes((a) => ({ ...a, [id]: { ...a[id], resultado: "…" } }));
    try {
      const res = await fetch(`/api/vita/acoes/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisao }),
      });
      const j = (await res.json()) as { status?: AcaoVita["status"]; resultado?: string; erro?: string };
      if (!res.ok) throw new Error(j.erro ?? `Erro ${res.status}`);
      setAcoes((a) => ({ ...a, [id]: { ...a[id], status: j.status ?? a[id].status, resultado: j.resultado ?? null } }));
      if (j.status === "executada") { toast.success("Feito", { description: j.resultado }); router.refresh(); }
      else if (j.status === "falhou") toast.error("Não foi possível executar", { description: j.resultado });
    } catch (e) {
      setAcoes((a) => ({ ...a, [id]: { ...a[id], resultado: null } }));
      toast.error("Não foi possível registrar a decisão", { description: e instanceof Error ? e.message : undefined });
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {arrastandoArquivo && createPortal(
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-background/60 p-4 backdrop-blur-[2px] animate-in fade-in-0 duration-150">
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-background px-10 py-8 text-center shadow-xl">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm shadow-primary/30">
              <Upload className="size-5" />
            </div>
            <p className="text-sm font-semibold">Solte para enviar à Vita</p>
            <p className="text-xs text-muted-foreground">PDF, fotos, planilhas, Word ou texto · até {MAX_ANEXOS} arquivos</p>
          </div>
        </div>,
        document.body,
      )}
      {/* Cabeçalho */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-sm shadow-primary/30">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold">Vita</p>
          <p className="truncate text-[11px] text-muted-foreground">Assistente de licitações</p>
        </div>
        <Historico atual={conversaId} onAbrir={abrirConversa} onApagada={(id) => { if (id === conversaId) novaConversa(); }} />
        <Button variant="ghost" size="icon" className="size-8" onClick={novaConversa} title="Nova conversa" aria-label="Nova conversa">
          <MessageSquarePlus className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onFechar} title="Fechar (⌘J)" aria-label="Fechar a Vita">
          <X className="size-4" />
        </Button>
      </header>

      {/* Mensagens */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {carregando ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Abrindo conversa…</p>
        ) : mensagens.length === 0 ? (
          <BoasVindas onEscolher={(s) => void enviar(s)} />
        ) : (
          <div className="flex flex-col gap-4">
            {mensagens.map((m) =>
              m.papel === "user" ? (
                <div key={m.id} className="ml-8 flex flex-col items-end gap-1.5 self-end">
                  {m.anexos.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-1">
                      {m.anexos.map((a, i) => {
                        const Icone = ICONE_ANEXO[a.tipo] ?? FileIcon;
                        return (
                          <span key={a.nome + i} title={a.observacao ?? a.nome} className="inline-flex max-w-52 items-center gap-1 rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                            <Icone className="size-3 shrink-0 text-primary" /> <span className="truncate">{a.nome}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {m.conteudo && (
                    <div className="rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">{m.conteudo}</div>
                  )}
                </div>
              ) : (
                <div key={m.id} className="flex flex-col gap-2">
                  {m.ferramentas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.ferramentas.map((f, i) => (
                        <span key={(f.id ?? f.nome) + i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          {f.estado === "rodando" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3 text-primary" />}
                          {f.rotulo}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.conteudo ? (
                    <Markdown texto={m.conteudo} />
                  ) : m.transmitindo && m.ferramentas.every((f) => f.estado === "ok") ? (
                    <span className="inline-flex gap-1 py-1" aria-label="A Vita está escrevendo">
                      {[0, 150, 300].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d}ms` }} />)}
                    </span>
                  ) : null}
                  {m.acoes.map((id) => acoes[id] && <CartaoAcao key={id} acao={acoes[id]} onDecidir={decidir} />)}
                  {m.erro && (
                    <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {m.erro}
                    </p>
                  )}
                </div>
              ),
            )}
            <div ref={fim} />
          </div>
        )}
      </div>

      {/* Campo de mensagem */}
      <form
        onSubmit={(e) => { e.preventDefault(); void enviar(); }}
        className="shrink-0 border-t p-3"
      >
        <div className="flex flex-col gap-2 rounded-xl border bg-background px-3 py-2 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
          {anexos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {anexos.map((a) => {
                const Icone = ICONE_ANEXO[a.tipo] ?? FileIcon;
                return (
                  <span
                    key={a.id}
                    title={a.erro ?? a.nome}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-lg border py-1 pl-2 pr-1 text-xs",
                      a.estado === "erro" ? "border-destructive/40 bg-destructive/5 text-destructive" : "bg-muted/50",
                    )}
                  >
                    {a.estado === "enviando" ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" /> : <Icone className="size-3.5 shrink-0 text-primary" />}
                    <span className="max-w-40 truncate">{a.nome}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{a.estado === "erro" ? "falhou" : tamanhoLegivel(a.tamanho)}</span>
                    <button type="button" onClick={() => removerAnexo(a.id)} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Remover ${a.nome}`}>
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex items-end gap-2">
          <input
            ref={seletor}
            type="file"
            multiple
            accept={ACEITOS}
            className="sr-only"
            onChange={(e) => { void adicionarArquivos(Array.from(e.target.files ?? [])); e.target.value = ""; }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 rounded-lg text-muted-foreground"
            onClick={() => seletor.current?.click()}
            disabled={anexos.length >= MAX_ANEXOS}
            title={`Anexar arquivos (até ${MAX_ANEXOS}): PDF, foto, planilha, Word`}
            aria-label="Anexar arquivos"
          >
            <Paperclip className="size-4" />
          </Button>
          <textarea
            ref={campo}
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void enviar(); } }}
            onPaste={(e) => { const arquivos = Array.from(e.clipboardData.files); if (arquivos.length) { e.preventDefault(); void adicionarArquivos(arquivos); } }}
            rows={1}
            placeholder={anexos.length ? "O que fazer com os arquivos?" : "Pergunte à Vita ou anexe arquivos…"}
            className="max-h-40 min-h-6 flex-1 resize-none bg-transparent py-0.5 text-sm outline-none [field-sizing:content] placeholder:text-muted-foreground"
          />
          {enviando ? (
            <Button type="button" size="icon" variant="secondary" className="size-7 shrink-0 rounded-lg" onClick={() => abortar.current?.abort()} title="Parar" aria-label="Parar resposta">
              <Square className="size-3 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="size-7 shrink-0 rounded-lg"
              disabled={enviandoAnexo || (!entrada.trim() && !anexosProntos.length)}
              title={enviandoAnexo ? "Aguarde o envio dos anexos" : "Enviar (Enter)"}
              aria-label="Enviar"
            >
              {enviandoAnexo ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          )}
          </div>
        </div>
        <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3" /> A Vita só altera algo depois da sua aprovação.
        </p>
      </form>
    </div>
  );
}

function BoasVindas({ onEscolher }: { onEscolher: (s: string) => void }) {
  return (
    <div className="flex flex-col gap-4 pt-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/30">
          <Sparkles className="size-6" />
        </div>
        <p className="text-base font-semibold">Olá! Eu sou a Vita.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onEscolher(s)}
            className="rounded-lg border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function CartaoAcao({ acao, onDecidir }: { acao: AcaoVita; onDecidir: (id: string, d: "aprovar" | "recusar") => void }) {
  const decidindo = acao.status === "pendente" && acao.resultado === "…";
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border text-sm",
        acao.status === "pendente" && "border-primary/40 bg-primary/[0.03]",
        acao.status === "executada" && "border-primary/30",
        (acao.status === "recusada" || acao.status === "falhou") && "opacity-80",
      )}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 font-medium">{acao.resumo}</p>
        {acao.status === "executada" && <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><CheckCircle2 className="size-3.5" /> Feito</span>}
        {acao.status === "recusada" && <span className="text-xs text-muted-foreground">Recusada</span>}
        {acao.status === "falhou" && <span className="inline-flex items-center gap-1 text-xs text-destructive"><XCircle className="size-3.5" /> Falhou</span>}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2 text-xs">
        {acao.detalhes.map((d) => (
          <div key={d.rotulo} className="contents">
            <dt className="text-muted-foreground">{d.rotulo}</dt>
            <dd className="min-w-0 break-words">{d.valor}</dd>
          </div>
        ))}
      </dl>
      {acao.aviso && (
        <p className="mx-3 mb-2 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {acao.aviso}
        </p>
      )}
      {acao.status === "pendente" ? (
        <div className="flex justify-end gap-2 border-t px-3 py-2">
          <Button size="sm" variant="ghost" disabled={decidindo} onClick={() => onDecidir(acao.id, "recusar")}>Recusar</Button>
          <Button size="sm" disabled={decidindo} onClick={() => onDecidir(acao.id, "aprovar")}>
            {decidindo ? <Loader2 className="animate-spin" /> : <Check />} Aprovar
          </Button>
        </div>
      ) : acao.resultado && acao.resultado !== "…" && acao.status !== "recusada" ? (
        <p className={cn("border-t px-3 py-1.5 text-xs", acao.status === "falhou" ? "text-destructive" : "text-muted-foreground")}>{acao.resultado}</p>
      ) : null}
    </div>
  );
}

function Historico({ atual, onAbrir, onApagada }: { atual: string | null; onAbrir: (id: string) => void; onApagada: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<ResumoConversa[] | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    const t = setTimeout(() => {
      listarConversas(busca).then((r) => { if (ativo) setLista(r); }).catch(() => { if (ativo) setLista([]); });
    }, busca ? 300 : 0);
    return () => { ativo = false; clearTimeout(t); };
  }, [aberto, busca]);

  async function apagar(id: string) {
    if (!window.confirm("Apagar esta conversa? Não dá para desfazer.")) return;
    try {
      await apagarConversa(id);
      setLista((l) => (l ?? []).filter((c) => c.id !== id));
      onApagada(id);
    } catch {
      toast.error("Não foi possível apagar");
    }
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" title="Conversas anteriores" aria-label="Conversas anteriores">
          <History className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="relative border-b p-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar nas conversas…"
            className="h-8 w-full bg-transparent pl-7 pr-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="max-h-80 overflow-auto p-1">
          {lista === null ? (
            <li className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Carregando…</li>
          ) : lista.length === 0 ? (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">{busca ? "Nada encontrado" : "Nenhuma conversa ainda"}</li>
          ) : (
            lista.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { onAbrir(c.id); setAberto(false); }}
                  className={cn("min-w-0 flex-1 rounded px-2 py-1.5 text-left text-sm hover:bg-accent", c.id === atual && "bg-accent")}
                >
                  <span className="block truncate">{c.titulo}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {new Date(c.atualizadaEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void apagar(c.id)}
                  className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Apagar conversa"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function Markdown({ texto }: { texto: string }) {
  return (
    <div className="text-sm leading-relaxed text-foreground [&>*+*]:mt-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">{children}</a>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          h1: ({ children }) => <p className="text-base font-semibold">{children}</p>,
          h2: ({ children }) => <p className="text-sm font-semibold">{children}</p>,
          h3: ({ children }) => <p className="text-sm font-semibold">{children}</p>,
          code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{children}</code>,
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60 text-left">{children}</thead>,
          th: ({ children }) => <th className="px-2 py-1.5 font-medium whitespace-nowrap">{children}</th>,
          td: ({ children }) => <td className="border-t px-2 py-1.5 align-top">{children}</td>,
        }}
      >
        {texto}
      </ReactMarkdown>
    </div>
  );
}
