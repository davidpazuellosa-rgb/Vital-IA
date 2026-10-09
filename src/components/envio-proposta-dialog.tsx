"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, CircleDashed, Clock, Copy, Download, ExternalLink, FileArchive, FileCheck2, FileSignature, Loader2, Paperclip, Send, Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AbrirSistema } from "@/components/sistemas-client";
import { formatarMoeda } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { desfazerEnvioProposta, obterPacoteEnvio, registrarEnvioProposta } from "@/lib/propostas/envio";
import { COR_NIVEL_PRAZO, prazoDe } from "@/lib/propostas/prazo";
import type { ItemEnvio, PacoteEnvio } from "@/lib/propostas/envio-types";
import { cn } from "@/lib/utils";

const sanitizar = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);
const dataHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
/** 1234.5 → "1234,50" (o que as plataformas aceitam colar em campo de preço). */
const decimal = (n: number) => n.toFixed(2).replace(".", ",");
const agoraLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

async function copiar(texto: string, rotulo: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(`${rotulo} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

export function EnvioPropostaDialog({
  licitacaoId,
  enviada = false,
  variant = "outline",
  size = "sm",
  compacto = false,
}: {
  licitacaoId: string;
  enviada?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [pacote, setPacote] = useState<PacoteEnvio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      setPacote(await obterPacoteEnvio(licitacaoId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }

  const jaEnviada = pacote ? Boolean(pacote.envio) : enviada;

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (v) void carregar(); }}>
      <Button
        variant={jaEnviada ? "secondary" : variant}
        size={size}
        onClick={() => { setAberto(true); void carregar(); }}
        aria-label={jaEnviada ? "Ver envio da proposta" : "Enviar proposta"}
      >
        {jaEnviada ? <CheckCircle2 className="text-primary" /> : <Send />}
        {!compacto && (jaEnviada ? "Enviada" : "Enviar proposta")}
        {compacto && <span className="hidden xl:inline">{jaEnviada ? "Enviada" : "Enviar"}</span>}
      </Button>
      <DialogContent className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="size-5 text-primary" /> Enviar proposta</DialogTitle>
          <DialogDescription>
            Confira o checklist, copie os dados na ordem do formulário e registre o envio. O envio em si é feito por você na plataforma.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-1">
          {carregando && !pacote && (
            <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando…</p>
          )}
          {erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
          {pacote && <Conteudo pacote={pacote} licitacaoId={licitacaoId} aoMudar={carregar} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Conteudo({ pacote, licitacaoId, aoMudar }: { pacote: PacoteEnvio; licitacaoId: string; aoMudar: () => Promise<void> }) {
  const { licitacao, plataforma, sistema, proposta, envio } = pacote;
  const prazo = prazoDe(licitacao.encerramento);
  const urlPlataforma = sistema?.url ?? licitacao.linkOrigem;
  const [conferi, setConferi] = useState({ precos: false, assinada: false, declaracoes: false });

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo */}
      <div className="rounded-lg border p-3">
        <p className="text-sm font-semibold leading-snug">{licitacao.titulo}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {licitacao.orgao} · {licitacao.municipio ? `${licitacao.municipio}/` : ""}{licitacao.uf} · {licitacao.modalidade}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copiar(licitacao.numeroControlePNCP, "Nº PNCP")}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted-foreground hover:text-foreground"
            title="Copiar número de controle PNCP"
          >
            {licitacao.numeroControlePNCP} <Copy className="size-3" />
          </button>
          {plataforma && <Badge variant="outline" className="font-normal">{plataforma.nome}</Badge>}
          <Badge variant="outline" className={cn("gap-1 font-medium", COR_NIVEL_PRAZO[prazo.nivel])}><Clock className="size-3" /> {prazo.texto}</Badge>
          <span className="text-xs text-muted-foreground">Propostas até {dataHora(licitacao.encerramento)}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {urlPlataforma ? (
            sistema ? (
              <AbrirSistema id={sistema.id} url={sistema.url} rotulo={`Abrir ${sistema.nome}`} className="" />
            ) : (
              <Button asChild size="sm"><a href={urlPlataforma} target="_blank" rel="noreferrer"><ExternalLink /> Abrir {plataforma?.nome ?? "a licitação"}</a></Button>
            )
          ) : (
            <span className="text-xs text-muted-foreground">O PNCP não informou o endereço do sistema desta licitação.</span>
          )}
          {sistema?.login && (
            <button type="button" onClick={() => void copiar(sistema.login, "Login")} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              Login: {sistema.login} <Copy className="size-3" />
            </button>
          )}
          {!sistema && plataforma && (
            <span className="text-xs text-muted-foreground">Dica: cadastre {plataforma.nome} em “Sistemas de Licitação” para reaproveitar a aba e o login.</span>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div className="rounded-lg border">
        <p className="border-b px-3 py-2 text-sm font-semibold">Checklist antes de enviar</p>
        <ul className="divide-y text-sm">
          <LinhaCheck
            ok={Boolean(proposta && proposta.itens.length > 0 && proposta.itensSemPreco === 0)}
            alerta={Boolean(proposta && proposta.itensSemPreco > 0)}
            titulo="Itens com preço"
            detalhe={!proposta ? "Ainda não há proposta montada no Vital.IA." : proposta.itensSemPreco > 0 ? `${proposta.itensSemPreco} item(ns) selecionado(s) sem preço.` : `${proposta.itens.filter((i) => i.selecionado).length} item(ns) · total ${formatarMoeda(proposta.valorTotal)}`}
          />
          <LinhaCheck
            ok={Boolean(proposta?.analisada && proposta.documentosPendentes === 0)}
            alerta={Boolean(proposta?.analisada && proposta.documentosPendentes > 0)}
            titulo="Documentos de habilitação"
            detalhe={!proposta?.analisada ? "O edital ainda não foi analisado." : proposta.documentosPendentes > 0 ? `${proposta.documentosPendentes} faltando ou vencido(s) (conforme a última análise).` : `${proposta.documentosDisponiveis} disponível(is) e em dia.`}
          />
          <LinhaCheck ok={prazo.nivel === "ok"} alerta={prazo.nivel !== "ok"} titulo="Prazo" detalhe={prazo.texto} />
          <LinhaManual marcado={conferi.precos} onChange={(v) => setConferi((c) => ({ ...c, precos: v }))} titulo="Conferi preços, marcas e quantidades" />
          <LinhaManual marcado={conferi.assinada} onChange={(v) => setConferi((c) => ({ ...c, assinada: v }))} titulo="Proposta final assinada (gov.br)" />
          <LinhaManual marcado={conferi.declaracoes} onChange={(v) => setConferi((c) => ({ ...c, declaracoes: v }))} titulo="Declarações assinadas, se o edital pedir" />
        </ul>
      </div>

      {/* Documentos para anexar */}
      <div className="rounded-lg border">
        <p className="border-b px-3 py-2 text-sm font-semibold">Documentos para anexar na plataforma</p>
        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          {proposta?.analisada && proposta.documentosDisponiveis > 0 ? (
            <Button asChild size="sm" variant="outline">
              <a href={`/api/propostas/${licitacaoId}/habilitacao`} download>
                <FileArchive /> Habilitação em ZIP ({proposta.documentosDisponiveis} doc{proposta.documentosDisponiveis > 1 ? "s" : ""})
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled title="Analise o edital e mantenha os documentos no acervo."><FileArchive /> Habilitação em ZIP</Button>
          )}
          {proposta?.analisada && proposta.declaracoes > 0 ? (
            <Button asChild size="sm" variant="outline">
              <a href={`/api/propostas/${licitacaoId}/declaracoes`} download>
                <FileSignature /> Declarações para assinar ({proposta.declaracoes})
              </a>
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled><FileSignature /> Declarações para assinar</Button>
          )}
          <p className="text-xs text-muted-foreground sm:basis-full">
            O ZIP só inclui documentos <strong>em dia</strong> (a validade é conferida na hora) e traz um LEIAME com o que entrou, o que ficou de fora e o que ainda falta.
            A proposta final assinada é gerada em “Abrir rascunho”.
          </p>
          {!proposta?.analisada && <p className="text-xs text-amber-700 dark:text-amber-400 sm:basis-full"><Download className="mr-1 inline size-3" /> Abra o rascunho da proposta uma vez para o edital ser analisado.</p>}
        </div>
      </div>

      {/* Itens para copiar */}
      {proposta && proposta.itens.some((i) => i.selecionado) && <TabelaItens itens={proposta.itens.filter((i) => i.selecionado)} />}

      {/* Registro do envio */}
      {envio ? (
        <EnvioFeito envio={envio} licitacaoId={licitacaoId} aoMudar={aoMudar} />
      ) : (
        <FormEnvio pacote={pacote} licitacaoId={licitacaoId} aoMudar={aoMudar} />
      )}
    </div>
  );
}

function LinhaCheck({ ok, alerta, titulo, detalhe }: { ok: boolean; alerta?: boolean; titulo: string; detalhe: string }) {
  const Icon = ok ? CheckCircle2 : alerta ? AlertTriangle : CircleDashed;
  return (
    <li className="flex items-start gap-2.5 px-3 py-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", ok ? "text-primary" : alerta ? "text-amber-600" : "text-muted-foreground")} />
      <div className="min-w-0"><p className="font-medium leading-tight">{titulo}</p><p className="text-xs text-muted-foreground">{detalhe}</p></div>
    </li>
  );
}

function LinhaManual({ marcado, onChange, titulo }: { marcado: boolean; onChange: (v: boolean) => void; titulo: string }) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2">
        <Checkbox checked={marcado} onCheckedChange={(v) => onChange(v === true)} />
        <span className={cn(marcado && "text-muted-foreground line-through")}>{titulo}</span>
      </label>
    </li>
  );
}

function TabelaItens({ itens }: { itens: ItemEnvio[] }) {
  const linhas = itens.map((i) => ({ ...i, total: (i.quantidade ?? 0) * i.valorUnitario }));
  const tsv = [
    ["Item", "Descrição", "Marca", "Qtd", "Un", "Valor unitário", "Valor total"].join("\t"),
    ...linhas.map((i) => [i.numeroItem, i.descricao.replace(/\s+/g, " "), i.marca, i.quantidade ?? "", i.unidadeMedida, decimal(i.valorUnitario), decimal(i.total)].join("\t")),
  ].join("\n");

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm font-semibold">Itens para copiar <span className="font-normal text-muted-foreground">· clique no valor para copiar</span></p>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => void copiar(linhas.map((i) => decimal(i.valorUnitario)).join("\n"), "Valores unitários")}>
            <Copy /> Só valores unitários
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copiar(tsv, "Tabela")}>
            <Copy /> Copiar tabela
          </Button>
        </div>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
            <tr><th className="px-3 py-1.5 text-left">Item</th><th className="px-3 py-1.5 text-left">Descrição</th><th className="px-3 py-1.5 text-left">Marca</th><th className="px-3 py-1.5 text-right">Qtd</th><th className="px-3 py-1.5 text-right">Unitário</th><th className="px-3 py-1.5 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map((i) => (
              <tr key={i.numeroItem} className="align-top">
                <td className="px-3 py-1.5 tabular-nums">{i.numeroItem}</td>
                <td className="max-w-xs px-3 py-1.5"><span className="line-clamp-2" title={i.descricao}>{i.descricao}</span></td>
                <td className="px-3 py-1.5">
                  {i.marca ? <CelulaCopiavel valor={i.marca} rotulo="Marca">{i.marca}</CelulaCopiavel> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{i.quantidade ?? "—"} {i.unidadeMedida}</td>
                <td className="px-3 py-1.5 text-right"><CelulaCopiavel valor={decimal(i.valorUnitario)} rotulo="Valor unitário">{formatarMoeda(i.valorUnitario)}</CelulaCopiavel></td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatarMoeda(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CelulaCopiavel({ valor, rotulo, children }: { valor: string; rotulo: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => void copiar(valor, rotulo)} title={`Copiar ${rotulo.toLowerCase()}`} className="rounded px-1 tabular-nums transition-colors hover:bg-primary/10 hover:text-primary">
      {children}
    </button>
  );
}

function FormEnvio({ pacote, licitacaoId, aoMudar }: { pacote: PacoteEnvio; licitacaoId: string; aoMudar: () => Promise<void> }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    const valorTexto = String(fd.get("valor") ?? "").replace(/\./g, "").replace(",", ".").trim();
    const valor = valorTexto ? Number(valorTexto) : null;
    if (valor != null && !Number.isFinite(valor)) { setErro("Valor inválido."); return; }

    startTransition(async () => {
      try {
        let comprovante: { path: string; nome: string } | null = null;
        if (arquivo) {
          const path = `${pacote.empresaUserId}/propostas/${licitacaoId}/${crypto.randomUUID()}/${sanitizar(arquivo.name)}`;
          const { error } = await createClient().storage.from("documentos").upload(path, arquivo, { contentType: arquivo.type || "application/octet-stream", upsert: false });
          if (error) throw new Error(`Falha ao enviar o comprovante: ${error.message}`);
          comprovante = { path, nome: arquivo.name };
        }
        await registrarEnvioProposta(licitacaoId, {
          enviadaEm: new Date(String(fd.get("quando"))).toISOString(),
          protocolo: String(fd.get("protocolo") ?? ""),
          valor,
          observacoes: String(fd.get("observacoes") ?? ""),
          comprovante,
        });
        toast.success("Envio registrado", { description: "A licitação foi movida para “Proposta enviada”." });
        router.refresh();
        await aoMudar();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao registrar.";
        setErro(msg);
        toast.error("Não foi possível registrar o envio", { description: msg });
      }
    });
  }

  return (
    <form onSubmit={salvar} className="rounded-lg border">
      <p className="border-b px-3 py-2 text-sm font-semibold">Depois de enviar na plataforma, registre aqui</p>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="env-quando">Enviada em</Label>
          <Input id="env-quando" name="quando" type="datetime-local" defaultValue={agoraLocal()} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="env-protocolo">Protocolo / nº do comprovante (opcional)</Label>
          <Input id="env-protocolo" name="protocolo" placeholder="Como aparece na plataforma" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="env-valor">Valor enviado, R$ (opcional)</Label>
          <Input id="env-valor" name="valor" inputMode="decimal" defaultValue={pacote.proposta?.valorTotal ? decimal(pacote.proposta.valorTotal) : ""} placeholder="0,00" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="env-obs">Observações (opcional)</Label>
          <Input id="env-obs" name="observacoes" placeholder="Ex.: enviada pelo David" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="env-arquivo">Comprovante (print ou PDF, opcional)</Label>
          <label htmlFor="env-arquivo" className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50">
            <Paperclip className="size-4" /> {arquivo ? <span className="truncate font-medium text-foreground">{arquivo.name}</span> : "Escolher arquivo"}
          </label>
          <input id="env-arquivo" type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      {erro && <p className="px-3 pb-2 text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end border-t p-3">
        <Button type="submit" disabled={pendente}>{pendente ? <Loader2 className="animate-spin" /> : <FileCheck2 />} Marcar como enviada</Button>
      </div>
    </form>
  );
}

function EnvioFeito({ envio, licitacaoId, aoMudar }: { envio: NonNullable<PacoteEnvio["envio"]>; licitacaoId: string; aoMudar: () => Promise<void> }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();

  function desfazer() {
    if (!window.confirm("Desfazer o registro de envio? A licitação volta para “Proposta pronta”.")) return;
    startTransition(async () => {
      try {
        await desfazerEnvioProposta(licitacaoId);
        toast.success("Envio desfeito");
        router.refresh();
        await aoMudar();
      } catch (err) {
        toast.error("Não foi possível desfazer", { description: err instanceof Error ? err.message : undefined });
      }
    });
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5">
      <p className="flex items-center gap-2 border-b border-primary/20 px-3 py-2 text-sm font-semibold text-primary"><CheckCircle2 className="size-4" /> Proposta enviada em {dataHora(envio.enviadaEm)}</p>
      <dl className="grid gap-x-4 gap-y-2 p-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Protocolo</dt><dd>{envio.protocolo || "—"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Valor enviado</dt><dd>{envio.valor != null ? formatarMoeda(envio.valor) : "—"}</dd></div>
        {envio.observacoes && <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Observações</dt><dd>{envio.observacoes}</dd></div>}
        <div className="sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Comprovante</dt>
          <dd>{envio.comprovanteUrl ? <a href={envio.comprovanteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><Paperclip className="size-3.5" /> {envio.comprovanteNome}</a> : "—"}</dd>
        </div>
      </dl>
      <div className="flex justify-end border-t border-primary/20 p-2">
        <Button type="button" variant="ghost" size="sm" onClick={desfazer} disabled={pendente}>{pendente ? <Loader2 className="animate-spin" /> : <Undo2 />} Desfazer envio</Button>
      </div>
    </div>
  );
}
