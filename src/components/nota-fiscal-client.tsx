"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Send, RefreshCw, FileDown, FileCode } from "lucide-react";
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
} from "@/lib/nota-fiscal/actions";
import { formatarMoeda } from "@/lib/format";
import type { NotaFiscalStatus } from "@/lib/nota-fiscal/types";

type ClienteOpcao = { id: string; nome: string; orgao: string };

type ItemEditor = {
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: string;
  valor_unitario: string;
};

const ITEM_VAZIO: ItemEditor = {
  descricao: "",
  ncm: "",
  cfop: "5101",
  unidade: "UN",
  quantidade: "1",
  valor_unitario: "0",
};

// Aceita tanto formato pt-BR ("1.000,50") quanto ponto decimal ("1000.50").
const paraNumero = (v: string) => {
  const s = String(v).trim();
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(norm) || 0;
};

/* ---------- Nova nota fiscal ---------- */
export function NovaNotaFiscal({ clientes }: { clientes: ClienteOpcao[] }) {
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  const [clienteId, setClienteId] = useState("");
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [nomeAuto, setNomeAuto] = useState("");
  const [itens, setItens] = useState<ItemEditor[]>([{ ...ITEM_VAZIO }]);

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
    setItens((atual) => [...atual, { ...ITEM_VAZIO }]);
  }
  function removerItem(indice: number) {
    setItens((atual) => (atual.length === 1 ? atual : atual.filter((_, i) => i !== indice)));
  }

  function resetar() {
    setClienteId("");
    setDestinatarioNome("");
    setNomeAuto("");
    setItens([{ ...ITEM_VAZIO }]);
    setErro(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    fd.set("clienteId", clienteId);
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
          </div>

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
              <div key={indice} className="flex flex-col gap-3 rounded-lg border p-3">
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
}: {
  id: string;
  status: NotaFiscalStatus;
  danfeUrl: string;
  xmlUrl: string;
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
