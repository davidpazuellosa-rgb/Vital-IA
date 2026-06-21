"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleAlert,
  Download,
  FileCheck2,
  FileSearch,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  garantirContratacaoPropostaFinal,
  listarDestinosPropostaFinal,
  registrarClienteDocumento,
  type DestinosPropostaFinal,
} from "@/lib/clientes/actions";
import { analisarEditalLicitacao, obterPropostaLicitacao, salvarRascunhoProposta, type ItemPropostaRascunho } from "@/lib/propostas/actions";
import type { AnaliseEdital, RequisitoEdital, StatusRequisito } from "@/lib/propostas/types";
import { cn } from "@/lib/utils";

export function CriarPropostaDialog({
  licitacaoId,
  temPropostaInicial = false,
  variant = "outline",
  size = "default",
  compacto = false,
  className,
}: {
  licitacaoId: string;
  temPropostaInicial?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
  compacto?: boolean;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [analise, setAnalise] = useState<AnaliseEdital | null>(null);
  const [itensSalvos, setItensSalvos] = useState<ItemPropostaRascunho[]>([]);
  const [rascunhoCarregado, setRascunhoCarregado] = useState(false);
  const [temProposta, setTemProposta] = useState(temPropostaInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [pendente, startTransition] = useTransition();
  const formularioId = `montagem-proposta-${licitacaoId}`;

  function executarAnalise() {
    setErro(null);
    startTransition(async () => {
      try {
        setAnalise(await analisarEditalLicitacao(licitacaoId));
        setItensSalvos([]);
        setRascunhoCarregado(false);
        setTemProposta(true);
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível analisar o edital.");
      }
    });
  }

  function carregarProposta() {
    setErro(null);
    startTransition(async () => {
      try {
        const proposta = await obterPropostaLicitacao(licitacaoId);
        if (proposta) {
          setAnalise(proposta.analise);
          setItensSalvos(proposta.itens);
          setRascunhoCarregado(true);
          setTemProposta(true);
        } else {
          setAnalise(await analisarEditalLicitacao(licitacaoId));
          setItensSalvos([]);
          setRascunhoCarregado(false);
          setTemProposta(true);
        }
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível carregar a proposta.");
      }
    });
  }

  function alterarAbertura(novoEstado: boolean) {
    setAberto(novoEstado);
    if (novoEstado && !analise && !pendente) carregarProposta();
  }

  return (
    <Dialog open={aberto} onOpenChange={alterarAbertura}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className} aria-label={temProposta ? "Abrir rascunho da proposta" : "Criar proposta"}>
          <FileText />
          {!compacto && (temProposta ? "Abrir rascunho" : "Criar proposta")}
          {compacto && <span className="hidden xl:inline">{temProposta ? "Abrir" : "Proposta"}</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSearch className="size-5 text-primary" /> {temProposta ? "Proposta em rascunho" : "Criar proposta"}</DialogTitle>
          <DialogDescription>
            Analise o edital, confira documentos e itens, informe os preços e exporte a proposta completa em PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-1">
          {pendente && <EstadoAnalisando />}
          {erro && <EstadoErro mensagem={erro} onTentarNovamente={executarAnalise} />}
          {analise && !pendente && (
            <ResultadoAnalise
              analise={analise}
              itensSalvos={itensSalvos}
              rascunhoCarregado={rascunhoCarregado}
              licitacaoId={licitacaoId}
              formularioId={formularioId}
              onExportandoChange={setExportando}
              onItensSalvosChange={setItensSalvos}
            />
          )}
        </div>

        {analise && !pendente && (
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={executarAnalise} disabled={exportando}><RefreshCw /> Analisar novamente</Button>
            <Button type="submit" form={formularioId} disabled={exportando || !analise.itens.length}>
              {exportando ? <Loader2 className="animate-spin" /> : <Download />}
              {exportando ? "Gerando PDF..." : "Exportar proposta em PDF"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EstadoAnalisando() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-5 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Loader2 className="size-7 animate-spin" /></div>
      <div className="space-y-1"><p className="font-semibold">Lendo o edital completo</p><p className="text-sm text-muted-foreground">Isso pode levar alguns instantes.</p></div>
      <div className="grid w-full max-w-lg gap-2 text-left sm:grid-cols-3">
        <EtapaAnalise texto="Baixando anexos" />
        <EtapaAnalise texto="Lendo todas as páginas" />
        <EtapaAnalise texto="Conferindo documentos" />
      </div>
    </div>
  );
}

function EtapaAnalise({ texto }: { texto: string }) {
  return <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin text-primary" />{texto}</div>;
}

function EstadoErro({ mensagem, onTentarNovamente }: { mensagem: string; onTentarNovamente: () => void }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive"><CircleAlert className="size-6" /></div>
      <div><p className="font-semibold">Não foi possível concluir a análise</p><p className="mt-1 text-sm text-muted-foreground">{mensagem}</p></div>
      <Button variant="outline" onClick={onTentarNovamente}><RefreshCw /> Tentar novamente</Button>
    </div>
  );
}

function ResultadoAnalise({
  analise,
  itensSalvos,
  rascunhoCarregado,
  licitacaoId,
  formularioId,
  onExportandoChange,
  onItensSalvosChange,
}: {
  analise: AnaliseEdital;
  itensSalvos: ItemPropostaRascunho[];
  rascunhoCarregado: boolean;
  licitacaoId: string;
  formularioId: string;
  onExportandoChange: (exportando: boolean) => void;
  onItensSalvosChange: (itens: ItemPropostaRascunho[]) => void;
}) {
  const disponiveis = analise.documentos.filter((item) => item.status === "disponivel").length;
  const pendencias = analise.documentos.filter((item) => item.status === "faltante" || item.status === "vencido").length;

  return (
    <div className="flex flex-col gap-4 pb-1">
      {!analise.cobertura.leituraCompleta && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div><p className="font-medium">Análise parcial</p><p className="text-xs text-muted-foreground">Há arquivo sem texto legível, formato não suportado ou falha de download. Faça a revisão manual antes do envio.</p></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Resumo rotulo="Arquivos lidos" valor={`${analise.cobertura.arquivosLidos}/${analise.cobertura.totalArquivos}`} />
        <Resumo rotulo="Páginas lidas" valor={String(analise.cobertura.paginasLidas)} />
        <Resumo rotulo="Documentos disponíveis" valor={String(disponiveis)} destaque />
        <Resumo rotulo="Pendências" valor={String(pendencias)} alerta={pendencias > 0} />
      </div>

      {rascunhoCarregado && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
          Proposta já existente carregada. Use “Analisar novamente” só se quiser refazer a leitura do edital.
        </div>
      )}

      <GrupoResultado titulo="Documentos exigidos" descricao="Cruzamento com o acervo da Vital Norte" quantidade={analise.documentos.length} aberto>
        {analise.documentos.length > 0 ? analise.documentos.map((item) => <LinhaRequisito key={`${item.nome}-${item.origem}`} item={item} />) : <Vazio texto="Nenhum documento de habilitação foi identificado automaticamente." />}
      </GrupoResultado>

      <GrupoResultado titulo="Declarações da proposta" descricao="Declarações específicas que precisam ser geradas" quantidade={analise.declaracoes.length} aberto>
        {analise.declaracoes.length > 0 ? analise.declaracoes.map((item) => <LinhaRequisito key={`${item.nome}-${item.origem}`} item={item} />) : <Vazio texto="Nenhuma declaração específica foi identificada automaticamente." />}
      </GrupoResultado>

      <MontagemProposta
        key={analise.analisadoEm}
        analise={analise}
        itensSalvos={itensSalvos}
        licitacaoId={licitacaoId}
        formularioId={formularioId}
        onExportandoChange={onExportandoChange}
        onItensSalvosChange={onItensSalvosChange}
      />

      <GrupoResultado titulo="Condições identificadas" descricao="Validade, entrega, pagamento, local e garantia" quantidade={analise.condicoes.length}>
        {analise.condicoes.length > 0 ? analise.condicoes.map((item) => (
          <div key={`${item.nome}-${item.origem}`} className="rounded-lg border px-3 py-2.5"><p className="font-medium">{item.nome}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.trecho}</p><p className="mt-1 text-[11px] text-primary">Fonte: {item.origem}</p></div>
        )) : <Vazio texto="Nenhuma condição foi identificada automaticamente." />}
      </GrupoResultado>

      <GrupoResultado titulo="Arquivos analisados" descricao="Cobertura da leitura do edital e anexos" quantidade={analise.arquivos.length}>
        {analise.arquivos.map((arquivo) => (
          <div key={arquivo.sequencial} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <FileCheck2 className={cn("size-4 shrink-0", arquivo.status === "lido" ? "text-primary" : "text-destructive")} />
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{arquivo.titulo}</p><p className="text-xs text-muted-foreground">{arquivo.metodoLeitura === "ocr" ? "OCR Groq" : arquivo.tipo} · {arquivo.paginas} página(s)</p></div>
            <Badge variant="outline" className={arquivo.status === "lido" ? "border-transparent bg-primary/10 text-primary" : "text-destructive"}>{rotuloArquivo(arquivo.status)}</Badge>
          </div>
        ))}
      </GrupoResultado>

      {analise.alertas.map((alerta) => <div key={alerta} className="flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{alerta}</div>)}
    </div>
  );
}

type ItemEmEdicao = AnaliseEdital["itens"][number] & {
  selecionado: boolean;
  marca: string;
  valorUnitario: string;
};

function MontagemProposta({
  analise,
  itensSalvos,
  licitacaoId,
  formularioId,
  onExportandoChange,
  onItensSalvosChange,
}: {
  analise: AnaliseEdital;
  itensSalvos: ItemPropostaRascunho[];
  licitacaoId: string;
  formularioId: string;
  onExportandoChange: (exportando: boolean) => void;
  onItensSalvosChange: (itens: ItemPropostaRascunho[]) => void;
}) {
  const [itens, setItens] = useState<ItemEmEdicao[]>(() => analise.itens.map((item) => ({
    ...item,
    selecionado: itensSalvos.find((salvo) => salvo.numeroItem === item.numeroItem)?.selecionado ?? true,
    marca: itensSalvos.find((salvo) => salvo.numeroItem === item.numeroItem)?.marca ?? "",
    valorUnitario: String(itensSalvos.find((salvo) => salvo.numeroItem === item.numeroItem)?.valorUnitario || item.valorUnitarioEstimado || ""),
  })));
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [declaracoesAssinadas, setDeclaracoesAssinadas] = useState<File | null>(null);
  const [propostaFinal, setPropostaFinal] = useState<File | null>(null);
  const [destinos, setDestinos] = useState<DestinosPropostaFinal | null>(null);
  const [clienteDestino, setClienteDestino] = useState("");
  const [contratacaoDestino, setContratacaoDestino] = useState("");
  const [mensagemArquivo, setMensagemArquivo] = useState<string | null>(null);
  const [mensagemDeclaracoes, setMensagemDeclaracoes] = useState<string | null>(null);
  const [mensagemPropostaFinal, setMensagemPropostaFinal] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);
  const [salvandoPropostaFinal, setSalvandoPropostaFinal] = useState(false);
  const [mensagemRascunho, setMensagemRascunho] = useState<string | null>(null);
  const [baixandoDeclaracoes, setBaixandoDeclaracoes] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const inputDeclaracoes = useRef<HTMLInputElement>(null);
  const inputPropostaFinal = useRef<HTMLInputElement>(null);
  const total = itens.reduce((soma, item) => {
    if (!item.selecionado) return soma;
    return soma + (item.quantidade ?? 0) * numeroEntrada(item.valorUnitario);
  }, 0);
  const selecionados = itens.filter((item) => item.selecionado);
  const preenchidos = selecionados.filter((item) => (item.quantidade ?? 0) > 0 && numeroEntrada(item.valorUnitario) > 0);
  const clienteSelecionado = destinos?.clientes.find((cliente) => cliente.id === clienteDestino) ?? null;
  const contratacoesDestino = clienteSelecionado?.contratacoes ?? [];

  useEffect(() => {
    let ativo = true;
    listarDestinosPropostaFinal(licitacaoId)
      .then((resultado) => {
        if (!ativo) return;
        setDestinos(resultado);
        setClienteDestino(resultado.sugestaoClienteId);
        setContratacaoDestino(resultado.sugestaoContratacaoId);
      })
      .catch((error) => {
        if (!ativo) return;
        setErro(error instanceof Error ? error.message : "Não foi possível carregar os clientes.");
      });
    return () => { ativo = false; };
  }, [licitacaoId]);

  function atualizar(numeroItem: number, campo: "selecionado" | "marca" | "valorUnitario", valor: boolean | string) {
    setItens((atuais) => atuais.map((item) => item.numeroItem === numeroItem ? { ...item, [campo]: valor } : item));
    setMensagemRascunho(null);
  }

  function itensParaRascunho(): ItemPropostaRascunho[] {
    return itens.map((item) => ({
      numeroItem: item.numeroItem,
      descricao: item.descricao,
      quantidade: item.quantidade ?? null,
      unidadeMedida: item.unidadeMedida,
      marca: item.marca,
      valorUnitario: numeroEntrada(item.valorUnitario),
      selecionado: item.selecionado,
    }));
  }

  async function salvarRascunho() {
    setErro(null);
    setMensagemRascunho(null);
    setSalvandoRascunho(true);
    try {
      const rascunho = itensParaRascunho();
      await salvarRascunhoProposta(licitacaoId, rascunho);
      onItensSalvosChange(rascunho);
      setMensagemRascunho("Rascunho salvo. Ao abrir esta licitação novamente, a mesma proposta será carregada.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar o rascunho.");
    } finally {
      setSalvandoRascunho(false);
    }
  }

  async function importarArquivo(novoArquivo: File | null) {
    setErro(null);
    setMensagemArquivo(null);
    setArquivo(novoArquivo);
    if (!novoArquivo) return;
    if (novoArquivo.size > 10 * 1024 * 1024) {
      setArquivo(null);
      setErro("O arquivo deve ter no máximo 10 MB.");
      return;
    }
    if (novoArquivo.type.startsWith("image/")) {
      setMensagemArquivo("Imagem anexada. Ela será incluída como apoio no PDF; confira os valores abaixo.");
      return;
    }
    try {
      const matriz = (novoArquivo.name.toLowerCase().endsWith(".csv")
        ? lerCsv(await novoArquivo.text())
        : await (await import("read-excel-file/browser")).default(novoArquivo)) as unknown[][];
      const [cabecalho = [], ...dados] = matriz;
      const linhas = dados.map((linha) => Object.fromEntries(cabecalho.map((coluna, indice) => [String(coluna ?? ""), linha[indice] ?? ""])));
      if (!linhas.length) throw new Error("A planilha não possui linhas de dados.");
      setItens((atuais) => atuais.map((item, indice) => {
        const linha = linhas.find((registro) => numeroPlanilha(registro) === item.numeroItem) ?? linhas[indice];
        if (!linha) return item;
        const marca = valorColuna(linha, /marca|fabricante/);
        const preco = valorColuna(linha, /valor.?unit|pre[cç]o.?unit|unit[aá]rio|vl.?unit/);
        return {
          ...item,
          selecionado: true,
          marca: marca ? String(marca) : item.marca,
          valorUnitario: preco !== "" ? String(numeroEntrada(String(preco))) : item.valorUnitario,
        };
      }));
      setMensagemArquivo(`${linhas.length} linha(s) importada(s). Confira os preços e as marcas antes de exportar.`);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    }
  }

  async function baixarDeclaracoes() {
    setErro(null);
    setBaixandoDeclaracoes(true);
    try {
      const resposta = await fetch("/api/propostas/" + licitacaoId + "/declaracoes");
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null) as { erro?: string } | null;
        throw new Error(corpo?.erro ?? "Não foi possível gerar as declarações.");
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeDownload(resposta.headers.get("content-disposition"));
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível gerar as declarações.");
    } finally {
      setBaixandoDeclaracoes(false);
    }
  }

  function importarDeclaracoesAssinadas(novoArquivo: File | null) {
    setErro(null);
    setMensagemDeclaracoes(null);
    setDeclaracoesAssinadas(novoArquivo);
    if (!novoArquivo) return;
    const ehPdf = novoArquivo.type === "application/pdf" || novoArquivo.name.toLowerCase().endsWith(".pdf");
    if (!ehPdf) {
      setDeclaracoesAssinadas(null);
      setErro("Envie as declarações assinadas em PDF.");
      return;
    }
    if (novoArquivo.size > 20 * 1024 * 1024) {
      setDeclaracoesAssinadas(null);
      setErro("O PDF de declarações assinadas deve ter no máximo 20 MB.");
      return;
    }
    setMensagemDeclaracoes("PDF assinado importado. Ele será anexado ao final da proposta exportada.");
  }

  async function importarPropostaFinal(novoArquivo: File | null) {
    setErro(null);
    setMensagemPropostaFinal(null);
    setPropostaFinal(novoArquivo);
    if (!novoArquivo) return;
    const ehPdf = novoArquivo.type === "application/pdf" || novoArquivo.name.toLowerCase().endsWith(".pdf");
    if (!ehPdf) {
      setPropostaFinal(null);
      setErro("Envie a proposta final em PDF.");
      return;
    }
    if (novoArquivo.size > 25 * 1024 * 1024) {
      setPropostaFinal(null);
      setErro("A proposta final deve ter no máximo 25 MB.");
      return;
    }
    if (!clienteDestino) {
      setPropostaFinal(null);
      setErro("Selecione o cliente antes de importar a proposta final.");
      return;
    }

    setSalvandoPropostaFinal(true);
    try {
      const contratacaoId = await garantirContratacaoPropostaFinal(licitacaoId, clienteDestino, contratacaoDestino || undefined);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");
      const docId = crypto.randomUUID();
      const path = user.id + "/clientes/" + clienteDestino + "/" + docId + "/" + sanitizarArquivo(novoArquivo.name);
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(path, novoArquivo, { contentType: novoArquivo.type || "application/pdf", upsert: false });
      if (uploadError) throw new Error("Falha no upload: " + uploadError.message);
      await registrarClienteDocumento({
        clienteId: clienteDestino,
        contratacaoId,
        tipo: "proposta",
        nome: "Proposta final - " + novoArquivo.name,
        path,
        arquivoNome: novoArquivo.name,
      });
      setContratacaoDestino(contratacaoId);
      setMensagemPropostaFinal("Proposta final importada e salva no cliente selecionado, na categoria Proposta enviada.");
    } catch (error) {
      setPropostaFinal(null);
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a proposta final no cliente.");
    } finally {
      setSalvandoPropostaFinal(false);
      if (inputPropostaFinal.current) inputPropostaFinal.current.value = "";
    }
  }

  async function exportar() {
    setErro(null);
    if (!selecionados.length) return setErro("Selecione ao menos um item para a proposta.");
    if (preenchidos.length !== selecionados.length) return setErro("Informe quantidade e valor unitário maior que zero em todos os itens selecionados.");
    onExportandoChange(true);
    try {
      const formData = new FormData();
      formData.set("rascunho_itens", JSON.stringify(itensParaRascunho()));
      formData.set("itens", JSON.stringify(preenchidos.map((item) => ({
        numeroItem: item.numeroItem,
        descricao: item.descricao,
        quantidade: item.quantidade,
        unidadeMedida: item.unidadeMedida,
        marca: item.marca,
        valorUnitario: numeroEntrada(item.valorUnitario),
      }))));
      if (arquivo?.type.startsWith("image/")) formData.set("arquivo_apoio", arquivo);
      if (declaracoesAssinadas) formData.set("declaracoes_assinadas", declaracoesAssinadas);
      const resposta = await fetch(`/api/propostas/${licitacaoId}/pdf`, { method: "POST", body: formData });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null) as { erro?: string } | null;
        throw new Error(corpo?.erro ?? "Não foi possível gerar a proposta.");
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeDownload(resposta.headers.get("content-disposition"));
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível gerar a proposta.");
    } finally {
      onExportandoChange(false);
    }
  }

  return (
    <form
      id={formularioId}
      className="rounded-xl border bg-background"
      onSubmit={(event) => {
        event.preventDefault();
        void exportar();
      }}
    >
      <div className="border-b px-4 py-3">
        <p className="font-semibold">Montagem da proposta</p>
        <p className="text-xs text-muted-foreground">Selecione os itens, informe marca e preço e gere o PDF com os documentos disponíveis.</p>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-lg border border-dashed p-3">
          <input
            ref={inputArquivo}
            type="file"
            className="sr-only"
            accept=".xlsx,.csv,image/png,image/jpeg"
            onChange={(event) => void importarArquivo(event.target.files?.[0] ?? null)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-medium">Planilha ou imagem de preços</p><p className="text-xs text-muted-foreground">Excel, CSV, PNG ou JPG, até 10 MB.</p></div>
            <Button type="button" variant="outline" size="sm" onClick={() => inputArquivo.current?.click()}><Upload /> Anexar arquivo</Button>
          </div>
          {arquivo && <p className="mt-2 truncate text-xs font-medium text-primary">{arquivo.name}</p>}
          {mensagemArquivo && <p className="mt-1 text-xs text-muted-foreground">{mensagemArquivo}</p>}
        </div>

        <div className="rounded-lg border border-dashed p-3">
          <input
            ref={inputDeclaracoes}
            type="file"
            className="sr-only"
            accept="application/pdf,.pdf"
            onChange={(event) => importarDeclaracoesAssinadas(event.target.files?.[0] ?? null)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Declarações para assinatura</p>
              <p className="text-xs text-muted-foreground">Baixe um PDF único com uma página por declaração, assine como David e importe o PDF assinado se o edital pedir anexos separados.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void baixarDeclaracoes()} disabled={baixandoDeclaracoes}>
                {baixandoDeclaracoes ? <Loader2 className="animate-spin" /> : <Download />}
                {baixandoDeclaracoes ? "Gerando..." : "Baixar declarações"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => inputDeclaracoes.current?.click()}>
                <Upload /> Importar assinado
              </Button>
            </div>
          </div>
          {declaracoesAssinadas && <p className="mt-2 truncate text-xs font-medium text-primary">{declaracoesAssinadas.name}</p>}
          {mensagemDeclaracoes && <p className="mt-1 text-xs text-muted-foreground">{mensagemDeclaracoes}</p>}
        </div>

        <div className="rounded-lg border border-dashed p-3">
          <input
            ref={inputPropostaFinal}
            type="file"
            className="sr-only"
            accept="application/pdf,.pdf"
            onChange={(event) => void importarPropostaFinal(event.target.files?.[0] ?? null)}
          />
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium">Proposta final do cliente</p>
                <p className="text-xs text-muted-foreground">
                  Depois de assinar a proposta final, importe o PDF aqui para salvar automaticamente no cliente em “Proposta enviada”.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputPropostaFinal.current?.click()}
                disabled={salvandoPropostaFinal || !clienteDestino}
              >
                {salvandoPropostaFinal ? <Loader2 className="animate-spin" /> : <Upload />}
                {salvandoPropostaFinal ? "Salvando..." : "Importar proposta final"}
              </Button>
            </div>

            {!destinos ? (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Carregando clientes disponíveis...
              </p>
            ) : destinos.clientes.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Cliente</span>
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={clienteDestino}
                    onChange={(event) => {
                      const novoCliente = event.target.value;
                      const cliente = destinos.clientes.find((item) => item.id === novoCliente);
                      setClienteDestino(novoCliente);
                      setContratacaoDestino(cliente?.contratacoes[0]?.id ?? "");
                      setMensagemPropostaFinal(null);
                    }}
                  >
                    {destinos.clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Contratação</span>
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={contratacaoDestino}
                    onChange={(event) => {
                      setContratacaoDestino(event.target.value);
                      setMensagemPropostaFinal(null);
                    }}
                  >
                    <option value="">Criar/usar contratação desta licitação</option>
                    {contratacoesDestino.map((contratacao) => (
                      <option key={contratacao.id} value={contratacao.id}>
                        {contratacao.identificador ? contratacao.identificador + " · " : ""}{contratacao.titulo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Cadastre um cliente em Vital Norte &gt; Clientes para liberar a importação da proposta final.
              </p>
            )}
          </div>
          {propostaFinal && <p className="mt-2 truncate text-xs font-medium text-primary">{propostaFinal.name}</p>}
          {mensagemPropostaFinal && <p className="mt-1 text-xs text-primary">{mensagemPropostaFinal}</p>}
        </div>

        <div className="overflow-hidden rounded-lg border">
          <div className="hidden grid-cols-[32px_minmax(0,1fr)_120px_135px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
            <span /><span>Item</span><span>Marca</span><span>Valor unitário</span>
          </div>
          <div className="max-h-80 divide-y overflow-y-auto">
            {itens.map((item) => (
              <div key={item.numeroItem} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 px-3 py-3 sm:grid-cols-[32px_minmax(0,1fr)_120px_135px] sm:items-center">
                <Checkbox checked={item.selecionado} onCheckedChange={(valor) => atualizar(item.numeroItem, "selecionado", valor === true)} aria-label={`Selecionar item ${item.numeroItem}`} />
                <div className="min-w-0"><p className="line-clamp-2 text-sm font-medium">{item.numeroItem}. {item.descricao}</p><p className="text-xs text-muted-foreground">{item.quantidade ?? "—"} {item.unidadeMedida}</p></div>
                <Input className="col-start-2 sm:col-start-auto" value={item.marca} onChange={(event) => atualizar(item.numeroItem, "marca", event.target.value)} placeholder="Marca" disabled={!item.selecionado} aria-label={`Marca do item ${item.numeroItem}`} />
                <div className="relative col-start-2 sm:col-start-auto"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span><Input className="pl-8 text-right tabular-nums" inputMode="decimal" value={item.valorUnitario} onChange={(event) => atualizar(item.numeroItem, "valorUnitario", event.target.value)} placeholder="0,00" disabled={!item.selecionado} aria-label={`Valor unitário do item ${item.numeroItem}`} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs text-muted-foreground">Valor global da proposta</p><p className="text-lg font-semibold tabular-nums text-primary">{moeda(total)}</p><p className="text-[11px] text-muted-foreground">{selecionados.length} item(ns) selecionado(s)</p></div>
          <Button type="button" variant="outline" size="sm" onClick={() => void salvarRascunho()} disabled={salvandoRascunho}>
            {salvandoRascunho ? <Loader2 className="animate-spin" /> : <Check />}
            {salvandoRascunho ? "Salvando..." : "Salvar rascunho"}
          </Button>
        </div>
        {mensagemRascunho && <p className="text-xs text-primary">{mensagemRascunho}</p>}
        {erro && <p className="flex items-start gap-2 text-xs text-destructive"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{erro}</p>}
      </div>
    </form>
  );
}

function numeroEntrada(valor: string): number {
  const limpo = valor.trim().replace(/\s/g, "");
  if (!limpo) return 0;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const numero = Number(normalizado.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numero) ? numero : 0;
}

function chavePlanilha(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function valorColuna(linha: Record<string, unknown>, padrao: RegExp): unknown {
  const chave = Object.keys(linha).find((item) => padrao.test(chavePlanilha(item)));
  return chave ? linha[chave] : "";
}

function lerCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  const separador = (conteudo.split(/\r?\n/, 1)[0].match(/;/g)?.length ?? 0) > (conteudo.split(/\r?\n/, 1)[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    if (caractere === '"') {
      if (aspas && conteudo[indice + 1] === '"') { campo += '"'; indice += 1; }
      else aspas = !aspas;
    } else if (caractere === separador && !aspas) {
      linha.push(campo.trim()); campo = "";
    } else if ((caractere === "\n" || caractere === "\r") && !aspas) {
      if (caractere === "\r" && conteudo[indice + 1] === "\n") indice += 1;
      linha.push(campo.trim()); campo = "";
      if (linha.some(Boolean)) linhas.push(linha);
      linha = [];
    } else campo += caractere;
  }
  linha.push(campo.trim());
  if (linha.some(Boolean)) linhas.push(linha);
  return linhas;
}

function numeroPlanilha(linha: Record<string, unknown>): number {
  return numeroEntrada(String(valorColuna(linha, /^(item|numero|nitem|id)$/)));
}

function moeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function nomeDownload(disposition: string | null): string {
  return disposition?.match(/filename="([^"]+)"/)?.[1] ?? "Proposta_Vital_Norte.pdf";
}

function sanitizarArquivo(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);
}

function Resumo({ rotulo, valor, destaque, alerta }: { rotulo: string; valor: string; destaque?: boolean; alerta?: boolean }) {
  return <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">{rotulo}</p><p className={cn("mt-1 text-lg font-semibold tabular-nums", destaque && "text-primary", alerta && "text-destructive")}>{valor}</p></div>;
}

function GrupoResultado({ titulo, descricao, quantidade, aberto = false, children }: { titulo: string; descricao: string; quantidade: number; aberto?: boolean; children: React.ReactNode }) {
  return (
    <details open={aberto} className="group rounded-xl border bg-background [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform [details[open]_&]:rotate-90" />
        <div className="min-w-0 flex-1"><p className="font-semibold">{titulo}</p><p className="truncate text-xs text-muted-foreground">{descricao}</p></div>
        <Badge variant="secondary" className="tabular-nums">{quantidade}</Badge>
      </summary>
      <div className="flex flex-col gap-2 border-t p-3">{children}</div>
    </details>
  );
}

const STATUS_REQUISITO: Record<StatusRequisito, { rotulo: string; classe: string; icon: typeof Check }> = {
  disponivel: { rotulo: "Disponível", classe: "border-transparent bg-primary/10 text-primary", icon: Check },
  faltante: { rotulo: "Faltante", classe: "border-transparent bg-destructive/10 text-destructive", icon: CircleAlert },
  vencido: { rotulo: "Vencido", classe: "border-transparent bg-destructive/10 text-destructive", icon: AlertTriangle },
  a_gerar: { rotulo: "A gerar", classe: "bg-muted text-muted-foreground", icon: FileText },
};

function LinhaRequisito({ item }: { item: RequisitoEdital }) {
  const status = STATUS_REQUISITO[item.status];
  const Icon = status.icon;
  return (
    <div className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="size-4 text-muted-foreground" /></div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{item.nome}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.trecho}</p>
        {item.documentoArquivo && (
          <p className="mt-1 truncate text-[11px] font-medium text-foreground">No sistema: {item.documentoNome ?? item.documentoArquivo} · {item.documentoArquivo}</p>
        )}
        <p className="mt-1 text-[11px] text-primary">Fonte: {item.origem}</p>
      </div>
      <Badge variant="outline" className={cn("shrink-0", status.classe)}>{status.rotulo}</Badge>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">{texto}</p>;
}

function rotuloArquivo(status: AnaliseEdital["arquivos"][number]["status"]): string {
  if (status === "lido") return "Lido";
  if (status === "sem_texto") return "Sem texto";
  if (status === "nao_suportado") return "Não suportado";
  return "Falha";
}
