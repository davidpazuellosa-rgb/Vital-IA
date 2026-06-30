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
  atualizarNotaFiscalRascunho,
  emitirNotaFiscal,
  consultarStatusNotaFiscal,
  removerNotaFiscal,
  anexarNotaNaContratacao,
  cancelarNotaFiscal,
  cartaCorrecaoNotaFiscal,
  buscarDadosCnpj,
} from "@/lib/nota-fiscal/actions";
import { formatarMoeda } from "@/lib/format";
import type { NotaFiscalStatus } from "@/lib/nota-fiscal/types";

type ClienteOpcao = {
  id: string; nome: string; orgao: string; cnpj: string; inscricao_estadual: string;
  cep: string; logradouro: string; numero: string; bairro: string; municipio: string; uf: string;
};
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

type NotaInicial = {
  id: string;
  cliente_id: string | null;
  contratacao_id: string | null;
  natureza_operacao: string;
  observacoes: string;
  destinatario_nome: string;
  destinatario_documento: string;
  destinatario_ie: string;
  destinatario_ind_ie: number | null;
  destinatario_cep: string;
  destinatario_logradouro: string;
  destinatario_numero: string;
  destinatario_bairro: string;
  destinatario_municipio: string;
  destinatario_uf: string;
  itens: {
    descricao: string; ncm: string; cfop: string; unidade: string; quantidade: number; valor_unitario: number;
  }[];
};

/* ---------- Nova nota fiscal (edita rascunho quando recebe `inicial`) ---------- */
export function NovaNotaFiscal({
  clientes,
  contratacoesPorCliente,
  inicial,
}: {
  clientes: ClienteOpcao[];
  contratacoesPorCliente: Record<string, ContratacaoOpcao[]>;
  inicial?: NotaInicial;
}) {
  const destInicial = () => ({
    documento: inicial?.destinatario_documento ?? "",
    ie: inicial?.destinatario_ie ?? "",
    cep: inicial?.destinatario_cep ?? "",
    logradouro: inicial?.destinatario_logradouro ?? "",
    numero: inicial?.destinatario_numero ?? "",
    bairro: inicial?.destinatario_bairro ?? "",
    municipio: inicial?.destinatario_municipio ?? "",
    uf: inicial?.destinatario_uf ?? "",
  });
  const indIeInicial = () => String(inicial?.destinatario_ind_ie ?? (inicial?.destinatario_ie ? 1 : 9));
  const tipoInicial = (): "interna" | "interestadual" =>
    inicial?.destinatario_uf && inicial.destinatario_uf.toUpperCase() !== "AM" ? "interestadual" : "interna";
  const itensIniciais = (): ItemEditor[] =>
    inicial?.itens?.length
      ? inicial.itens.map((i) => ({
          id: crypto.randomUUID(),
          descricao: i.descricao,
          ncm: i.ncm,
          cfop: i.cfop,
          unidade: i.unidade,
          quantidade: String(i.quantidade),
          valor_unitario: String(i.valor_unitario),
        }))
      : [novoItem()];

  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const router = useRouter();

  const [clienteId, setClienteId] = useState(inicial?.cliente_id ?? "");
  const [contratacaoId, setContratacaoId] = useState(inicial?.contratacao_id ?? "");
  const [destinatarioNome, setDestinatarioNome] = useState(inicial?.destinatario_nome ?? "");
  const [nomeAuto, setNomeAuto] = useState("");
  const [tipoOperacao, setTipoOperacao] = useState<"interna" | "interestadual">(tipoInicial());
  const [dest, setDest] = useState(destInicial());
  const [indIe, setIndIe] = useState(indIeInicial());
  const [itens, setItens] = useState<ItemEditor[]>(itensIniciais());

  const setDestCampo = (k: keyof typeof dest, v: string) => setDest((d) => ({ ...d, [k]: v }));

  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  // Evita reconsultar o mesmo CNPJ a cada tecla/blur.
  const [cnpjBuscado, setCnpjBuscado] = useState("");

  // Ao completar 14 dígitos no documento, busca nome e endereço na Receita (BrasilAPI)
  // e preenche o destinatário. Só atua para CNPJ — CPF (11 díg.) não tem base pública.
  async function buscarCnpjAuto(valor: string) {
    const doc = valor.replace(/\D/g, "");
    if (doc.length !== 14 || doc === cnpjBuscado || buscandoCnpj) return;
    setCnpjBuscado(doc);
    setBuscandoCnpj(true);
    try {
      const dados = await buscarDadosCnpj(doc);
      // Sobrescreve o nome só se estiver vazio ou ainda for o auto-preenchido.
      setDestinatarioNome((atual) => (!atual.trim() || atual === nomeAuto ? dados.nome : atual));
      setNomeAuto(dados.nome);
      setDest((cur) => ({
        ...cur,
        cep: dados.cep || cur.cep,
        logradouro: dados.logradouro || cur.logradouro,
        numero: dados.numero || cur.numero,
        bairro: dados.bairro || cur.bairro,
        municipio: dados.municipio || cur.municipio,
        uf: dados.uf || cur.uf,
      }));
      if (dados.uf) aplicarTipoOperacao(dados.uf === "AM" ? "interna" : "interestadual");
      toast.success("Dados do CNPJ preenchidos");
    } catch (err) {
      setCnpjBuscado(""); // permite tentar de novo depois de uma falha
      toast.error("Não foi possível buscar o CNPJ", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBuscandoCnpj(false);
    }
  }

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
    // Preenche o destinatário com os dados do órgão guardados no cliente.
    setDest((cur) => ({
      documento: cliente.cnpj || cur.documento,
      ie: cliente.inscricao_estadual || cur.ie,
      cep: cliente.cep || cur.cep,
      logradouro: cliente.logradouro || cur.logradouro,
      numero: cliente.numero || cur.numero,
      bairro: cliente.bairro || cur.bairro,
      municipio: cliente.municipio || cur.municipio,
      uf: cliente.uf || cur.uf,
    }));
    setIndIe(cliente.inscricao_estadual ? "1" : "9");
    if (cliente.uf) aplicarTipoOperacao(cliente.uf === "AM" ? "interna" : "interestadual");
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
    setClienteId(inicial?.cliente_id ?? "");
    setContratacaoId(inicial?.contratacao_id ?? "");
    setDestinatarioNome(inicial?.destinatario_nome ?? "");
    setNomeAuto("");
    setTipoOperacao(tipoInicial());
    setDest(destInicial());
    setIndIe(indIeInicial());
    setItens(itensIniciais());
    setErro(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);

    // Validação imediata dos itens (o servidor revalida como defesa).
    for (let k = 0; k < itens.length; k++) {
      const it = itens[k];
      const n = k + 1;
      const ncm = it.ncm.replace(/\D/g, "");
      const cfop = it.cfop.replace(/\D/g, "");
      if (!it.descricao.trim()) return setErro(`Item ${n}: informe a descrição.`);
      if (ncm.length !== 8 && ncm.length !== 2) return setErro(`Item ${n}: NCM deve ter 8 dígitos.`);
      if (cfop.length !== 4) return setErro(`Item ${n}: CFOP deve ter 4 dígitos.`);
      if (paraNumero(it.quantidade) <= 0) return setErro(`Item ${n}: informe a quantidade.`);
      if (paraNumero(it.valor_unitario) <= 0) return setErro(`Item ${n}: informe o valor unitário.`);
    }

    const fd = new FormData(e.currentTarget);
    fd.set("clienteId", clienteId);
    fd.set("contratacaoId", contratacaoId);
    fd.set("destinatarioIndIe", indIe);
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
        if (inicial) await atualizarNotaFiscalRascunho(inicial.id, fd);
        else await criarNotaFiscal(fd);
        setAberto(false);
        if (!inicial) resetar();
        toast.success(inicial ? "Rascunho atualizado" : "Rascunho criado", {
          description: inicial ? undefined : "Revise e clique em Emitir para enviar à SEFAZ.",
        });
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao salvar a nota.";
        setErro(msg);
        toast.error(inicial ? "Não foi possível salvar" : "Não foi possível criar a nota", { description: msg });
      }
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) resetar(); }}>
      <DialogTrigger asChild>
        {inicial ? (
          <Button variant="outline" size="sm">
            <PencilLine className="size-4" /> Editar
          </Button>
        ) : (
          <Button>
            <Plus /> Nova nota
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{inicial ? "Editar rascunho" : "Nova nota fiscal"}</DialogTitle>
          <DialogDescription>
            {inicial
              ? "Altere os dados do rascunho. A emissão à SEFAZ continua no botão Emitir."
              : "Cria um rascunho. A emissão para a SEFAZ é feita depois, no botão Emitir."}
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
                defaultValue={inicial?.natureza_operacao ?? "Venda de mercadoria"}
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
                <div className="relative">
                  <Input
                    id="destinatarioDocumento"
                    name="destinatarioDocumento"
                    value={dest.documento}
                    onChange={(e) => {
                      setDestCampo("documento", e.target.value);
                      buscarCnpjAuto(e.target.value);
                    }}
                    onBlur={(e) => buscarCnpjAuto(e.target.value)}
                    placeholder="Preenchido pelo cliente"
                    required
                  />
                  {buscandoCnpj && (
                    <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {buscandoCnpj ? "Buscando dados na Receita…" : "CNPJ busca nome e endereço automaticamente."}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Indicação de IE (ICMS)</Label>
                <Select value={indIe} onValueChange={setIndIe}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9">Não contribuinte (órgão público comum)</SelectItem>
                    <SelectItem value="1">Contribuinte (com IE)</SelectItem>
                    <SelectItem value="2">Contribuinte isento de IE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioIe">Inscrição estadual {indIe === "1" ? "" : "(opcional)"}</Label>
                <Input id="destinatarioIe" name="destinatarioIe" value={dest.ie} onChange={(e) => setDestCampo("ie", e.target.value)} placeholder="Deixe vazio se isento/não contribuinte" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioCep">CEP</Label>
                <Input id="destinatarioCep" name="destinatarioCep" value={dest.cep} onChange={(e) => setDestCampo("cep", e.target.value)} placeholder="Só números" required />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="destinatarioLogradouro">Logradouro</Label>
                <Input id="destinatarioLogradouro" name="destinatarioLogradouro" value={dest.logradouro} onChange={(e) => setDestCampo("logradouro", e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioNumero">Número</Label>
                <Input id="destinatarioNumero" name="destinatarioNumero" value={dest.numero} onChange={(e) => setDestCampo("numero", e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioBairro">Bairro</Label>
                <Input id="destinatarioBairro" name="destinatarioBairro" value={dest.bairro} onChange={(e) => setDestCampo("bairro", e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioMunicipio">Município</Label>
                <Input id="destinatarioMunicipio" name="destinatarioMunicipio" value={dest.municipio} onChange={(e) => setDestCampo("municipio", e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="destinatarioUf">UF</Label>
                <Input id="destinatarioUf" name="destinatarioUf" value={dest.uf} onChange={(e) => setDestCampo("uf", e.target.value.toUpperCase())} maxLength={2} placeholder="Ex.: AM" required />
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
              defaultValue={inicial?.observacoes ?? ""}
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
              {pendente && <Loader2 className="animate-spin" />}{" "}
              {inicial ? "Salvar alterações" : "Salvar rascunho"}
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

  function emitir() {
    const t = toast.loading("Enviando à SEFAZ…");
    startTransition(async () => {
      try {
        const res = await emitirNotaFiscal(id);
        if (res.ok) toast.success("Nota enviada", { id: t });
        else toast.error("Não foi possível emitir", { id: t, description: res.mensagem });
        router.refresh();
      } catch (e) {
        toast.error("Falha ao emitir", { id: t, description: e instanceof Error ? e.message : undefined });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      {status === "rascunho" && (
        <Button
          size="sm"
          onClick={emitir}
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
