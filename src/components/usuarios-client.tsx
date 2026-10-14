"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, MoreHorizontal, Pencil, Plus, ShieldOff, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { atualizarUsuario, criarUsuario, definirBloqueio, gerarLinkUsuario, removerUsuario } from "@/lib/usuarios/actions";
import { CARGOS, type Cargo, type StatusUsuario, type UsuarioLinha } from "@/lib/usuarios/tipos";
import { EMPRESAS, type EmpresaSlug } from "@/lib/empresas";

const LISTA_EMPRESAS: EmpresaSlug[] = ["vital-norte", "rm"];

const STATUS: Record<StatusUsuario, { rotulo: string; classe: string }> = {
  ativo: { rotulo: "Ativo", classe: "bg-primary/10 text-primary" },
  pendente: { rotulo: "Convite pendente", classe: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  expirado: { rotulo: "Convite expirado", classe: "bg-destructive/10 text-destructive" },
  bloqueado: { rotulo: "Bloqueado", classe: "bg-muted text-muted-foreground" },
};

type Formulario = { id: string | null; email: string; nome: string; cargo: Cargo; empresas: EmpresaSlug[] };
const VAZIO: Formulario = { id: null, email: "", nome: "", cargo: "admin", empresas: [] };

export function UsuariosClient({ usuarios, meuId }: { usuarios: UsuarioLinha[]; meuId: string }) {
  const [form, setForm] = useState<Formulario | null>(null);
  const [link, setLink] = useState<{ email: string; url: string; redefinir: boolean } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendente, startTransition] = useTransition();

  function salvar() {
    if (!form) return;
    startTransition(async () => {
      const entrada = { nome: form.nome, cargo: form.cargo, empresas: form.empresas };
      if (form.id) {
        const r = await atualizarUsuario(form.id, entrada);
        if (!r.ok) return void toast.error(r.erro);
        toast.success("Usuário atualizado");
        setForm(null);
      } else {
        const r = await criarUsuario({ ...entrada, email: form.email });
        if (!r.ok) return void toast.error(r.erro);
        setForm(null);
        setLink({ email: form.email.trim().toLowerCase(), url: r.link, redefinir: false });
        setCopiado(false);
      }
    });
  }

  function novoLink(u: UsuarioLinha) {
    startTransition(async () => {
      const r = await gerarLinkUsuario(u.id);
      if (!r.ok) return void toast.error(r.erro);
      setLink({ email: u.email, url: r.link, redefinir: u.status === "ativo" });
      setCopiado(false);
    });
  }

  function bloquear(u: UsuarioLinha, bloquear: boolean) {
    startTransition(async () => {
      const r = await definirBloqueio(u.id, bloquear);
      if (!r.ok) return void toast.error(r.erro);
      toast.success(bloquear ? "Acesso bloqueado" : "Acesso liberado");
    });
  }

  function remover(u: UsuarioLinha) {
    if (!window.confirm(`Remover ${u.email}? O convite deixa de valer.`)) return;
    startTransition(async () => {
      const r = await removerUsuario(u.id);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Usuário removido");
    });
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar; selecione o link e copie.");
    }
  }

  const alternarEmpresa = (slug: EmpresaSlug, marcado: boolean) =>
    setForm((f) => (f ? { ...f, empresas: marcado ? [...new Set([...f.empresas, slug])] : f.empresas.filter((e) => e !== slug) } : f));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ ...VAZIO })}>
          <Plus /> Novo usuário
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Usuário</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Empresas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-4">
                    <div className="flex flex-col">
                      <span className="font-medium">{u.nome || u.email}</span>
                      {u.nome && <span className="text-xs text-muted-foreground">{u.email}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.cargo === "super_admin" ? "default" : "secondary"}>{CARGOS[u.cargo]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.cargo === "super_admin" ? (
                        <Badge variant="outline">Todas</Badge>
                      ) : (
                        u.empresas.map((e) => <Badge key={e} variant="outline">{EMPRESAS[e].nome}</Badge>)
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex h-5 items-center rounded-4xl px-2 text-xs font-medium ${STATUS[u.status].classe}`}>
                      {STATUS[u.status].rotulo}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Ações de ${u.email}`} disabled={pendente}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setForm({ id: u.id, email: u.email, nome: u.nome, cargo: u.cargo, empresas: u.empresas })}>
                          <Pencil /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => novoLink(u)}>
                          <KeyRound /> {u.status === "ativo" ? "Link para redefinir senha" : "Gerar novo link"}
                        </DropdownMenuItem>
                        {u.id !== meuId && (
                          <>
                            <DropdownMenuSeparator />
                            {u.status === "bloqueado" ? (
                              <DropdownMenuItem onSelect={() => bloquear(u, false)}><ShieldCheck /> Liberar acesso</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => bloquear(u, true)}><ShieldOff /> Bloquear acesso</DropdownMenuItem>
                            )}
                            {(u.status === "pendente" || u.status === "expirado") && (
                              <DropdownMenuItem variant="destructive" onSelect={() => remover(u)}><Trash2 /> Remover</DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Novo usuário / editar */}
      <Dialog open={form !== null} onOpenChange={(o) => !o && !pendente && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="u-email">E-mail</Label>
                <Input id="u-email" type="email" value={form.email} disabled={Boolean(form.id)} autoComplete="off"
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="pessoa@empresa.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="u-nome">Nome</Label>
                <Input id="u-nome" value={form.nome} autoComplete="off" onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Cargo</Label>
                <Select value={form.cargo} onValueChange={(v) => setForm({ ...form, cargo: v as Cargo })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{CARGOS.admin}</SelectItem>
                    <SelectItem value="super_admin">{CARGOS.super_admin}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.cargo === "admin" ? (
                <div className="flex flex-col gap-2">
                  <Label>Empresas que pode ver</Label>
                  {LISTA_EMPRESAS.map((slug) => (
                    <label key={slug} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.empresas.includes(slug)} onCheckedChange={(c) => alternarEmpresa(slug, c === true)} />
                      {EMPRESAS[slug].nome}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Super admin vê todas as empresas e gerencia os usuários.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={pendente}>Cancelar</Button>
            <Button onClick={salvar} disabled={pendente || !form || (!form.id && !form.email.trim())}>
              {pendente ? <Loader2 className="animate-spin" /> : form?.id ? <Check /> : <UserPlus />}
              {form?.id ? "Salvar" : "Criar e gerar link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link para enviar */}
      <Dialog open={link !== null} onOpenChange={(o) => !o && setLink(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{link?.redefinir ? "Link para redefinir a senha" : "Link de acesso criado"}</DialogTitle>
          </DialogHeader>
          {link && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Envie para {link.email}. Vale por 7 dias e só funciona uma vez.</p>
              <div className="flex gap-2">
                <Input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} aria-label="Link de acesso" />
                <Button onClick={() => copiar(link.url)} aria-label="Copiar link">
                  {copiado ? <Check /> : <Copy />} Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Depois de fechar, o link não aparece de novo; gere outro se precisar.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLink(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
