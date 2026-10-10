"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Brain, Loader2, Pencil, Plus, Search, ThumbsDown, ThumbsUp, Trash2, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  atualizarMemoria, criarMemoria, definirFerramenta, definirMemoriaConfig, removerMemoria,
} from "@/lib/vita/ajustes-actions";
import {
  CATEGORIAS_MEMORIA, INFO_FERRAMENTAS, TIPOS_FERRAMENTA, type InfoFerramenta, type TipoFerramenta,
} from "@/lib/vita/catalogo-ferramentas";
import type { ConfigVita, Memoria } from "@/lib/vita/memoria";
import type { Avaliacao } from "@/lib/vita/feedback";
import { removerAvaliacao } from "@/lib/vita/feedback-actions";
import { cn } from "@/lib/utils";

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const rotuloCategoria = (id: string) => CATEGORIAS_MEMORIA.find((c) => c.id === id)?.rotulo ?? "Geral";
const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const msg = (e: unknown) => (e instanceof Error ? e.message : undefined);

type Aba = "memorias" | "ferramentas" | "avaliacoes";

export function VitaAjustesClient({ config: configInicial, memorias: memoriasIniciais, avaliacoes: avaliacoesIniciais }: { config: ConfigVita; memorias: Memoria[]; avaliacoes: Avaliacao[] }) {
  const [aba, setAba] = useState<Aba>("memorias");
  const [config, setConfig] = useState(configInicial);
  const [memorias, setMemorias] = useState(memoriasIniciais);
  const [avaliacoes, setAvaliacoes] = useState(avaliacoesIniciais);

  const ferramentasAtivas = INFO_FERRAMENTAS.filter((f) => !config.desativadas.includes(f.nome)).length;
  const abas: Array<{ id: Aba; rotulo: string; icone: typeof Brain; contagem: string }> = [
    { id: "memorias", rotulo: "Memórias", icone: Brain, contagem: String(memorias.length) },
    { id: "ferramentas", rotulo: "Ferramentas", icone: Wrench, contagem: `${ferramentasAtivas}/${INFO_FERRAMENTAS.length}` },
    { id: "avaliacoes", rotulo: "Avaliações", icone: ThumbsUp, contagem: String(avaliacoes.length) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Vita" className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/35 p-2 sm:max-w-2xl">
        {abas.map((a) => {
          const sel = aba === a.id;
          return (
            <button
              key={a.id}
              role="tab"
              type="button"
              aria-selected={sel}
              onClick={() => setAba(a.id)}
              className={cn(
                "flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                sel ? "border-primary/35 bg-background text-foreground shadow-sm" : "border-transparent text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold"><a.icone className="size-4 shrink-0" />{a.rotulo}</span>
              <Badge variant={sel ? "default" : "secondary"} className="shrink-0 tabular-nums">{a.contagem}</Badge>
            </button>
          );
        })}
      </div>

      {aba === "memorias" ? (
        <PainelMemorias config={config} setConfig={setConfig} memorias={memorias} setMemorias={setMemorias} />
      ) : aba === "ferramentas" ? (
        <PainelFerramentas config={config} setConfig={setConfig} />
      ) : (
        <PainelAvaliacoes config={config} setConfig={setConfig} avaliacoes={avaliacoes} setAvaliacoes={setAvaliacoes} />
      )}
    </div>
  );
}

/* ----------------------------------------- memórias ----------------------------------------- */

function PainelMemorias({
  config, setConfig, memorias, setMemorias,
}: {
  config: ConfigVita;
  setConfig: React.Dispatch<React.SetStateAction<ConfigVita>>;
  memorias: Memoria[];
  setMemorias: React.Dispatch<React.SetStateAction<Memoria[]>>;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [editando, setEditando] = useState<Memoria | "nova" | null>(null);
  const [, iniciar] = useTransition();

  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return memorias.filter((m) => (categoria === "todas" || m.categoria === categoria) && (!termo || semAcento(m.conteudo).includes(termo)));
  }, [memorias, busca, categoria]);

  function configurar(campo: "memoriaAtiva" | "memoriaAutomatica", valor: boolean) {
    const antes = config;
    setConfig({ ...config, [campo]: valor });
    iniciar(async () => {
      try { await definirMemoriaConfig({ [campo]: valor }); } catch (e) { setConfig(antes); toast.error("Não foi possível salvar", { description: msg(e) }); }
    });
  }

  function alternar(m: Memoria, ativo: boolean) {
    setMemorias((l) => l.map((x) => (x.id === m.id ? { ...x, ativo } : x)));
    iniciar(async () => {
      try { await atualizarMemoria(m.id, { ativo }); } catch (e) {
        setMemorias((l) => l.map((x) => (x.id === m.id ? { ...x, ativo: m.ativo } : x)));
        toast.error("Não foi possível salvar", { description: msg(e) });
      }
    });
  }

  function apagar(m: Memoria) {
    if (!window.confirm("Apagar esta memória? A Vita deixa de usá-la.")) return;
    const antes = memorias;
    setMemorias((l) => l.filter((x) => x.id !== m.id));
    iniciar(async () => {
      try { await removerMemoria(m.id); toast.success("Memória apagada"); } catch (e) {
        setMemorias(antes);
        toast.error("Não foi possível apagar", { description: msg(e) });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-sm">
        <CardContent className="flex flex-col divide-y">
          <LinhaConfig titulo="Memória ativada" ajuda="Desligada, a Vita não usa nem guarda memórias." valor={config.memoriaAtiva} aoMudar={(v) => configurar("memoriaAtiva", v)} />
          <LinhaConfig
            titulo="Memorizar automaticamente"
            ajuda="Ligada, a Vita guarda sozinha o que for útil. Desligada, só quando você pedir."
            valor={config.memoriaAutomatica}
            desabilitado={!config.memoriaAtiva}
            aoMudar={(v) => configurar("memoriaAutomatica", v)}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar nas memórias…" aria-label="Pesquisar nas memórias" className="pl-9 pr-8" />
          {busca && (
            <button type="button" onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Limpar pesquisa">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-40" aria-label="Categoria"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {CATEGORIAS_MEMORIA.map((c) => <SelectItem key={c.id} value={c.id}>{c.rotulo}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button className="ml-auto gap-1.5" onClick={() => setEditando("nova")}><Plus className="size-4" /> Adicionar memória</Button>
      </div>

      {memorias.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Brain className="size-6" /></div>
            <p className="font-medium">Nenhuma memória ainda</p>
            <Button className="gap-1.5" onClick={() => setEditando("nova")}><Plus className="size-4" /> Adicionar memória</Button>
          </CardContent>
        </Card>
      ) : visiveis.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma memória com esse filtro.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((m) => (
            <li key={m.id}>
              <Card className={cn("shadow-sm transition-opacity", (!m.ativo || !config.memoriaAtiva) && "opacity-60")}>
                <CardContent className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed">{m.conteudo}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="font-normal">{rotuloCategoria(m.categoria)}</Badge>
                      <Badge variant="outline" className="font-normal">{m.origem === "vita" ? "Anotada pela Vita" : "Adicionada por você"}</Badge>
                      <span className="text-xs text-muted-foreground">{dataBr(m.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch checked={m.ativo} onCheckedChange={(v) => alternar(m, v)} aria-label={m.ativo ? "Desativar memória" : "Ativar memória"} title={m.ativo ? "Ativa: a Vita usa" : "Desativada: a Vita ignora"} />
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditando(m)} aria-label="Editar memória" title="Editar"><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => apagar(m)} aria-label="Apagar memória" title="Apagar"><Trash2 className="size-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <FormMemoria
        aberto={editando !== null}
        memoria={editando && editando !== "nova" ? editando : null}
        aoFechar={() => setEditando(null)}
        aoSalvar={(m, nova) => setMemorias((l) => (nova ? [m, ...l] : l.map((x) => (x.id === m.id ? m : x))))}
      />
    </div>
  );
}

function LinhaConfig({
  titulo, ajuda, valor, desabilitado, aoMudar,
}: { titulo: string; ajuda: string; valor: boolean; desabilitado?: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0", desabilitado && "opacity-50")} title={ajuda}>
      <span className="text-sm font-medium">{titulo}</span>
      <Switch checked={valor && !desabilitado} disabled={desabilitado} onCheckedChange={aoMudar} aria-label={titulo} />
    </div>
  );
}

function FormMemoria({
  aberto, memoria, aoFechar, aoSalvar,
}: { aberto: boolean; memoria: Memoria | null; aoFechar: () => void; aoSalvar: (m: Memoria, nova: boolean) => void }) {
  // Remonta o formulário a cada abertura para começar com os valores certos.
  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) aoFechar(); }}>
      {aberto && <ConteudoForm key={memoria?.id ?? "nova"} memoria={memoria} aoFechar={aoFechar} aoSalvar={aoSalvar} />}
    </Dialog>
  );
}

function ConteudoForm({ memoria, aoFechar, aoSalvar }: { memoria: Memoria | null; aoFechar: () => void; aoSalvar: (m: Memoria, nova: boolean) => void }) {
  const [conteudo, setConteudo] = useState(memoria?.conteudo ?? "");
  const [categoria, setCategoria] = useState<string>(memoria?.categoria ?? "geral");
  const [salvando, iniciar] = useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    iniciar(async () => {
      try {
        if (memoria) {
          await atualizarMemoria(memoria.id, { conteudo, categoria });
          aoSalvar({ ...memoria, conteudo: conteudo.replace(/\s+/g, " ").trim(), categoria: categoria as Memoria["categoria"], updated_at: new Date().toISOString() }, false);
        } else {
          aoSalvar(await criarMemoria(conteudo, categoria), true);
        }
        toast.success(memoria ? "Memória atualizada" : "Memória adicionada");
        aoFechar();
      } catch (err) {
        toast.error("Não foi possível salvar", { description: msg(err) });
      }
    });
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{memoria ? "Editar memória" : "Nova memória"}</DialogTitle>
        <DialogDescription>Um fato ou preferência da empresa que a Vita deve lembrar.</DialogDescription>
      </DialogHeader>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="memoria-texto">Memória</Label>
          <textarea
            id="memoria-texto"
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={4}
            maxLength={600}
            autoFocus
            required
            placeholder="Ex.: Atendemos prioritariamente AM, PA e RR. Margem mínima padrão de 20%."
            className="min-h-24 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <span className="self-end text-[11px] text-muted-foreground tabular-nums">{conteudo.length}/600</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIAS_MEMORIA.map((c) => <SelectItem key={c.id} value={c.id}>{c.rotulo}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={aoFechar}>Cancelar</Button>
          <Button type="submit" disabled={salvando || conteudo.trim().length < 3}>
            {salvando && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* --------------------------------------- ferramentas --------------------------------------- */

const COR_TIPO: Record<TipoFerramenta, string> = {
  consulta: "bg-secondary text-secondary-foreground",
  externa: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  aprovacao: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  memoria: "bg-primary/10 text-primary",
  conversa: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  tela: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};
const ROTULO_TIPO: Record<TipoFerramenta, string> = { consulta: "Lê", externa: "Fonte externa", aprovacao: "Pede aprovação", memoria: "Memória", conversa: "Conversa", tela: "Tela" };

function PainelFerramentas({ config, setConfig }: { config: ConfigVita; setConfig: React.Dispatch<React.SetStateAction<ConfigVita>> }) {
  const [, iniciar] = useTransition();

  function alternar(f: InfoFerramenta, ativa: boolean) {
    const antes = config;
    setConfig({ ...config, desativadas: ativa ? config.desativadas.filter((n) => n !== f.nome) : [...config.desativadas, f.nome] });
    iniciar(async () => {
      try { await definirFerramenta(f.nome, ativa); } catch (e) { setConfig(antes); toast.error("Não foi possível salvar", { description: msg(e) }); }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {(Object.keys(TIPOS_FERRAMENTA) as TipoFerramenta[]).map((tipo) => {
        const lista = INFO_FERRAMENTAS.filter((f) => f.tipo === tipo);
        return (
          <section key={tipo} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{TIPOS_FERRAMENTA[tipo].titulo}</h2>
            <Card className="shadow-sm">
              <CardContent className="flex flex-col divide-y">
                {lista.map((f) => {
                  const ativa = !config.desativadas.includes(f.nome);
                  const bloqueadaPelaMemoria = f.tipo === "memoria" && !config.memoriaAtiva;
                  return (
                    <div key={f.nome} className={cn("flex items-center gap-3 py-3 first:pt-0 last:pb-0", (!ativa || bloqueadaPelaMemoria) && "opacity-60")}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{f.titulo}</span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", COR_TIPO[f.tipo])}>{ROTULO_TIPO[f.tipo]}</span>
                        </div>
                        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{f.descricao}</p>
                      </div>
                      <Switch checked={ativa} onCheckedChange={(v) => alternar(f, v)} aria-label={`${ativa ? "Desativar" : "Ativar"} ${f.titulo}`} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        );
      })}
    </div>
  );
}

/* ---------------------------------------- avaliações ---------------------------------------- */

function PainelAvaliacoes({
  config, setConfig, avaliacoes, setAvaliacoes,
}: {
  config: ConfigVita;
  setConfig: React.Dispatch<React.SetStateAction<ConfigVita>>;
  avaliacoes: Avaliacao[];
  setAvaliacoes: React.Dispatch<React.SetStateAction<Avaliacao[]>>;
}) {
  const [, iniciar] = useTransition();
  const gostou = avaliacoes.filter((a) => a.nota === 1).length;

  function aprender(valor: boolean) {
    const antes = config;
    setConfig({ ...config, aprenderFeedback: valor });
    iniciar(async () => {
      try { await definirMemoriaConfig({ aprenderFeedback: valor }); } catch (e) { setConfig(antes); toast.error("Não foi possível salvar", { description: msg(e) }); }
    });
  }

  function apagar(a: Avaliacao) {
    const antes = avaliacoes;
    setAvaliacoes((l) => l.filter((x) => x.id !== a.id));
    iniciar(async () => {
      try { await removerAvaliacao(a.id); } catch (e) { setAvaliacoes(antes); toast.error("Não foi possível apagar", { description: msg(e) }); }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <LinhaConfig titulo="Aprender com minhas avaliações" ajuda="Ligado, a Vita usa suas avaliações 👍/👎 recentes para ajustar o jeito de responder." valor={config.aprenderFeedback} aoMudar={aprender} />
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><ThumbsUp className="size-4 text-primary" /> {gostou}</span>
            <span className="inline-flex items-center gap-1.5"><ThumbsDown className="size-4 text-destructive" /> {avaliacoes.length - gostou}</span>
          </div>
        </CardContent>
      </Card>

      {avaliacoes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><ThumbsUp className="size-6" /></div>
            <p className="font-medium">Nenhuma avaliação ainda</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {avaliacoes.map((a) => (
            <li key={a.id}>
              <Card className="shadow-sm">
                <CardContent className="flex items-start gap-3">
                  <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", a.nota === 1 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                    {a.nota === 1 ? <ThumbsUp className="size-4" /> : <ThumbsDown className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{a.pedido || "(pedido não registrado)"}</p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{a.resposta}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {a.motivo && <Badge variant="outline" className="font-normal">{a.motivo}</Badge>}
                      <span className="text-xs text-muted-foreground">{dataBr(a.created_at)}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => apagar(a)} aria-label="Apagar avaliação" title="Apagar"><Trash2 className="size-4" /></Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
