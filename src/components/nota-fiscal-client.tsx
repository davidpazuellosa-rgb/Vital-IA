"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Send, RefreshCw, FileDown, FileCode, Paperclip, Ban, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  criarNotaFiscal,
  emitirNotaFiscal,
  consultarStatusNotaFiscal,
  removerNotaFiscal,
  anexarNotaNaContratacao,
  cancelarNotaFiscal,
  cartaCorrecaoNotaFiscal,
} from "@/lib/nota-fiscal/actions";
import { formatarMoeda } from "@/lib/format";
import type { NotaFiscalStatus } from "@/lib/nota-fiscal/types";

type ClienteOpcao = { id: string; nome: string; orgao: string };
type ContratacaoOpcao = { id: string; titulo: string; identificador: string };

type ItemEditor = {
  id: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: string;
  valor_unitario: string;
};

const ITEM_VAZIO: Omit<ItemEditor, "id"> = {
  descricao: "",
  ncm: "",
  cfop: "5101",
  unidade: "UN",
  quantidade: "1",
  valor_unitario: "0",
};

const novoItem = (): ItemEditor => ({ ...ITEM_VAZIO, id: crypto.randomUUID() });

// Aceita tanto formato pt-BR ("1.000,50") quanto ponto decimal ("1000.50").
const paraNumero = (v: string) => {
  const s = String(v).trim();
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(norm) || 0;
};

/* ---------- Nova nota fiscal ---------- */
export function NovaNotaFiscal({
  clientes,
  contratacoesPorCliente,
}: {
  clientes: ClienteOpcao[];
  contratacoesPorCliente: Record<string, ContratacaoOpcao[]>;
}) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  const [clienteId, setClienteId] = useState("");
  const [contratacaoId, setContratacaoId] = useState("");
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [nomeAuto, setNomeAuto] = useState("");
  const [tipoOperacao, setTipoOperacao] = useState<"interna" | "interestadual">("interna");
  const [itens, setItens] = useState<ItemEditor[]>([novoItem()]);

  // CFOP: 5xxx = dentro do estado (AM); 6xxx = interestadual. Troca só o 1º dígito,
  // preservando o resto do CFOP escolhido em cada item.
  function aplicarTipoOperacao(tipo: "interna" | "interestadual") {
    setTipoOperacao(tipo);
    const prefixo = tipo === "interestadual" ? "6" : "5";
    setItens((atual) => atual.map((it) => (it.cfop ? { ...it, cfop: prefixo + it.cfop.slice(1) } : it)));
  }

  const contratacoesDoCliente = clienteId ? (contratacoesPorCliente[clienteId] ?? []) : [];

  const total = useMemo(
    () =>
      itens.reduce(
        (s, i) => s + Number((paraNumero(i.quantidade) * paraNumero(i.valor_unitario)).toFixed(2)),
        0,
      ),
    [itens],
  );

  function escolherCliente(id: string) {
    setClienteId(id);
    setContratacaoId(""); // contratações dependem do cliente
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return;
    // Sobrescreve o nome se estiver vazio ou ainda for o auto-preenchido (não editado à mão).
    setDestinatarioNome((atual) => (!atual.trim() || atual === nomeAuto ? cliente.nome : atual));
    setNomeAuto(cliente.nome);
  }

  function atualizarItem(indice: number, patch: Partial<ItemEditor>) {
    setItens((atual) => atual.map((it, i) => (i === indice ? { ...it, ...patch } : it)));
  }
  function adicionarItem() {
    const prefixo = tipoOperacao === "interestadual" ? "6" : "5";
    const item = novoItem();
    setItens((atual) => [...atual, { ...item, cfop: prefixo + item.cfop.slice(1) }]);
  }
  function removerItem(indice: number) {
    setItens((atual) => (atual.length === 1 ? atual : atual.filter((_, i) => i !== indice)));
  }

  function resetar() {
    setClienteId("");
    setContratacaoId("");
    setDestinatarioNome("");
    setNomeAuto("");
    setItens([novoItem()]);
    setErro(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    fd.set("clienteId", clienteId);
    fd.set("contratacaoId", contratacaoId);
    fd.set(
      "itens",
      JSON.stringify(
        itens.map((i) => ({
          descricao: i.descricao,
          ncm: i.ncm,
          cfop: i.cfop,
          unidade: i.unidade,
          quantidade: paraNumero(i.quantidade),
          valor_unitario: paraNumero(i.valor_unitario),
        })),
      ),
    );
    startTransition(async () => {
      try {
        await criarNotaFiscal(fd);
        setAberto(false);
        resetar();
        toast.success("Rascunho criado", { description: "Revise e clique em Emitir para enviar à SEFAZ." });
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao criar a nota.";
        setErro(msg);
        toast.error("Não foi possível criar a nota", { description: msg });
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) resetar(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nova nota
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova nota fiscal</DialogTitle>
          <DialogDescription>
            Cria um rascunho. A emissão para a SEFAZ é feita depois, no botão Emitir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {/* Cliente + natureza */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Cliente (opcional)</Label>
              <Select value={clienteId} onValueChange={escolherCliente}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Vincular a um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="naturezaOperacao">Natureza da operação</Label>
              <Input
                id="naturezaOperacao"
                name="naturezaOperacao"
                defaultValue="Venda de mercadoria"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo de operação</Label>
              <Select value={tipoOperacao} onValueChange={(v) => aplicarTipoOperacao(v as "interna" | "interestadual")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interna">Interna (dentro do AM)</SelectItem>
                  <SelectItem value="interestadual">Interestadual (outro estado)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Ajusta o CFOP (5xxx interna / 6xxx interestadual).</p>
            </div>
          </div>

          {contratacoesDoCliente.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Contratação (opcional)</Label>
              <Select value={contratacaoId} onValueChange={setContratacaoId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Vincular a uma contratação" />
                </SelectTrigger>
                <SelectContent>
                  {contratacoesDoCliente.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.titulo}
                      {c.identificador ? ` · ${c.identificador}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Destinatário */}
          <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Destinatário (órgão)
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioNome">Nome / razão social</Label>
                <Input
                  id="destinatarioNome"
                  name="destinatarioNome"
                  value={destinatarioNome}
                  onChange={(e) => setDestinatarioNome(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioDocumento">CNPJ / CPF</Label>
                <Input id="destinatarioDocumento" name="destinatarioDocumento" placeholder="Só números" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioIe">Inscrição estadual (opcional)</Label>
                <Input id="destinatarioIe" name="destinatarioIe" placeholder="Deixe vazio se isento" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioCep">CEP</Label>
                <Input id="destinatarioCep" name="destinatarioCep" placeholder="Só números" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="destinatarioLogradouro">Logradouro</Label>
                <Input id="destinatarioLogradouro" name="destinatarioLogradouro" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioNumero">Número</Label>
                <Input id="destinatarioNumero" name="destinatarioNumero" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioBairro">Bairro</Label>
                <Input id="destinatarioBairro" name="destinatarioBairro" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioMunicipio">Município</Label>
                <Input id="destinatarioMunicipio" name="destinatarioMunicipio" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioUf">UF</Label>
                <Input id="destinatarioUf" name="destinatarioUf" maxLength={2} placeholder="Ex.: AM" />
              </div>
            </div>
          </fieldset>

          {/* Itens */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Itens
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={adicionarItem}>
                <Plus /> Adicionar item
              </Button>
            </div>

            {itens.map((item, indice) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={item.descricao}
                      onChange={(e) => atualizarItem(indice, { descricao: e.target.value })}
                      placeholder="Ex.: Açúcar cristal - saca"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6 size-8 text-destructive"
                    onClick={() => removerItem(indice)}
                    disabled={itens.length === 1}
                    aria-label="Remover item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">NCM</Label>
                    <Input value={item.ncm} onChange={(e) => atualizarItem(indice, { ncm: e.target.value })} placeholder="17019900" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">CFOP</Label>
                    <Input value={item.cfop} onChange={(e) => atualizarItem(indice, { cfop: e.target.value })} placeholder="5101" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Unidade</Label>
                    <Input value={item.unidade} onChange={(e) => atualizarItem(indice, { unidade: e.target.value })} placeholder="KG" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Qtd.</Label>
                    <Input
                      inputMode="decimal"
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(indice, { quantidade: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Valor unit.</Label>
                    <Input
                      inputMode="decimal"
                      value={item.valor_unitario}
                      onChange={(e) => atualizarItem(indice, { valor_unitario: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Observações */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <textarea
              id="observacoes"
              name="observacoes"
              rows={2}
              className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
              placeholder="Ex.: PROAD 19056.2026 — NE 2026NE000567"
            />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{formatarMoeda(total)}</span>
            </span>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pendente}>
              {pendente && <Loader2 className="animate-spin" />} Salvar rascunho
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Ações de uma nota (card) ---------- */
export function NotaFiscalAcoes({
  id,
  status,
  danfeUrl,
  xmlUrl,
  contratacaoId,
  jaAnexada,
}: {
  id: string;
  status: NotaFiscalStatus;
  danfeUrl: string;
  xmlUrl: string;
  contratacaoId?: string | null;
  jaAnexada?: boolean;
}) {
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function executar(acao: () => Promise<void>, carregando: string, sucesso: string) {
    const t = toast.loading(carregando);
    startTransition(async () => {
      try {
        await acao();
        toast.success(sucesso, { id: t });
        router.refresh();
      } catch (e) {
        toast.error("Falha", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      {status === "rascunho" && (
        <Button
          size="sm"
          onClick={() => executar(() => emitirNotaFiscal(id), "Enviando à SEFAZ…", "Nota enviada")}
          disabled={pendente}
        >
          {pendente ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Emitir
        </Button>
      )}

      {status === "processando" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            executar(() => consultarStatusNotaFiscal(id), "Consultando status…", "Status atualizado")
          }
          disabled={pendente}
        >
          {pendente ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Atualizar status
        </Button>
      )}

      {danfeUrl && (
        <Button size="sm" variant="outline" asChild>
          <a href={danfeUrl} target="_blank" rel="noreferrer">
            <FileDown className="size-4" /> DANFE
          </a>
        </Button>
      )}
      {xmlUrl && (
        <Button size="sm" variant="outline" asChild>
          <a href={xmlUrl} target="_blank" rel="noreferrer">
            <FileCode className="size-4" /> XML
          </a>
        </Button>
      )}

      {status === "autorizada" && contratacaoId && !jaAnexada && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            executar(
              () => anexarNotaNaContratacao(id),
              "Anexando à contratação…",
              "Anexada à contratação",
            )
          }
          disabled={pendente}
        >
          {pendente ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />} Anexar à contratação
        </Button>
      )}

      {status === "autorizada" && contratacaoId && jaAnexada && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="size-3.5" /> Anexada à contratação
        </span>
      )}

      {(status === "rascunho" || status === "rejeitada" || status === "cancelada") && (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            if (!confirm("Remover esta nota?")) return;
            executar(() => removerNotaFiscal(id), "Removendo…", "Nota removida");
          }}
          disabled={pendente}
        >
          <Trash2 className="size-4" /> Remover
        </Button>
      )}
    </div>
  );
}

/* ---------- Ações avançadas (página de detalhe) ---------- */
const TEXTAREA_CLASS =
  "flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function NotaFiscalAcoesAvancadas({
  id,
  status,
}: {
  id: string;
  status: NotaFiscalStatus;
}) {
  if (status !== "autorizada") return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      <CartaCorrecaoDialog id={id} />
      <CancelarNotaDialog id={id} />
    </div>
  );
}

function CartaCorrecaoDialog({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function fechar(v: boolean) {
    setAberto(v);
    if (!v) {
      setTexto("");
      setErro(null);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      try {
        await cartaCorrecaoNotaFiscal(id, texto);
        fechar(false);
        toast.success("Carta de correção registrada");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao registrar a correção.";
        setErro(msg);
        toast.error("Falha na carta de correção", { description: msg });
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PencilLine className="size-4" /> Carta de correção
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carta de correção (CC-e)</DialogTitle>
          <DialogDescription>
            Corrige erros que não alteram valores, impostos nem as partes da nota. Mínimo de 15 caracteres.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <textarea
            className={TEXTAREA_CLASS}
            rows={4}
            maxLength={1000}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Descreva a correção…"
          />
          <p className="text-xs text-muted-foreground">
            {texto.trim().length} caracteres (mín. 15, máx. 1000)
          </p>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pendente || texto.trim().length < 15}>
              {pendente && <Loader2 className="animate-spin" />} Registrar correção
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelarNotaDialog({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  function fechar(v: boolean) {
    setAberto(v);
    if (!v) {
      setTexto("");
      setErro(null);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      try {
        await cancelarNotaFiscal(id, texto);
        fechar(false);
        toast.success("Nota cancelada");
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao cancelar a nota.";
        setErro(msg);
        toast.error("Falha ao cancelar", { description: msg });
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <Ban className="size-4" /> Cancelar nota
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar NF-e</DialogTitle>
          <DialogDescription>
            O cancelamento é definitivo e enviado à SEFAZ. Informe a justificativa (mínimo de 15 caracteres).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <textarea
            className={TEXTAREA_CLASS}
            rows={3}
            maxLength={255}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: Erro na descrição do produto acordado com o órgão."
          />
          <p className="text-xs text-muted-foreground">
            {texto.trim().length} caracteres (mín. 15, máx. 255)
          </p>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pendente || texto.trim().length < 15}>
              {pendente && <Loader2 className="animate-spin" />} Confirmar cancelamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
