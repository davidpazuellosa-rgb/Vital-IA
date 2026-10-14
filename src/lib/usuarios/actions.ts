"use server";

import { randomBytes, createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolverEmpresaUserId } from "@/lib/empresa/escopo";
import { exigirSuperAdmin } from "@/lib/acesso";
import { ehEmpresaSlug, type EmpresaSlug } from "@/lib/empresas";
import { VALIDADE_CONVITE_DIAS, type Cargo, type StatusUsuario, type UsuarioLinha } from "./tipos";

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

async function linkDoConvite(token: string): Promise<string> {
  let base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!base) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    base = `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
  }
  return `${base}/convite/${token}`;
}

/** Gera um token novo, grava só o hash e devolve o link. */
async function emitirConvite(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + VALIDADE_CONVITE_DIAS * 86_400_000).toISOString();
  const { error } = await createServiceClient()
    .from("usuarios_perfil")
    .update({ convite_hash: hashToken(token), convite_expira_em: expira })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return linkDoConvite(token);
}

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };
type EntradaUsuario = { nome: string; cargo: Cargo; empresas: string[] };

function validar(e: EntradaUsuario): { cargo: Cargo; empresas: EmpresaSlug[]; nome: string } | string {
  if (e.cargo !== "super_admin" && e.cargo !== "admin") return "Escolha um cargo.";
  const empresas = [...new Set(e.empresas.filter(ehEmpresaSlug))];
  if (e.cargo === "admin" && empresas.length === 0) return "Escolha ao menos uma empresa para o admin.";
  return {
    cargo: e.cargo,
    empresas: e.cargo === "super_admin" ? ["vital-norte", "rm"] : empresas,
    nome: e.nome.trim().slice(0, 120),
  };
}

export async function listarUsuarios(): Promise<UsuarioLinha[]> {
  await exigirSuperAdmin();
  const service = createServiceClient();
  const [{ data: perfis }, { data: lista }] = await Promise.all([
    service.from("usuarios_perfil").select("*").order("created_at", { ascending: true }),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const emails = new Map((lista?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const agora = Date.now();
  return (perfis ?? []).map((p) => {
    let status: StatusUsuario = "ativo";
    if (p.bloqueado_em) status = "bloqueado";
    else if (!p.senha_definida_em) {
      status = p.convite_expira_em && new Date(p.convite_expira_em).getTime() < agora ? "expirado" : "pendente";
    }
    return {
      id: p.user_id, email: emails.get(p.user_id) ?? "", nome: p.nome ?? "", cargo: p.cargo as Cargo,
      empresas: ((p.empresas as string[]) ?? []).filter(ehEmpresaSlug), status,
    };
  });
}

export async function criarUsuario(entrada: EntradaUsuario & { email: string }): Promise<Resultado<{ link: string }>> {
  const eu = await exigirSuperAdmin();
  const email = entrada.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: "E-mail inválido." };
  const v = validar(entrada);
  if (typeof v === "string") return { ok: false, erro: v };

  const service = createServiceClient();
  const { data: criado, error } = await service.auth.admin.createUser({
    email, email_confirm: true, password: randomBytes(24).toString("base64url"),
  });
  if (error || !criado.user) {
    const jaExiste = /already|registered|exists/i.test(error?.message ?? "");
    return { ok: false, erro: jaExiste ? "Já existe um usuário com este e-mail." : (error?.message ?? "Não foi possível criar o usuário.") };
  }
  const novoId = criado.user.id;

  try {
    const supabase = await createClient();
    const dono = await resolverEmpresaUserId(supabase, eu.userId);
    if (novoId !== dono) {
      const { error: e1 } = await service.from("empresa_membros").upsert({ user_id: novoId, empresa_user_id: dono });
      if (e1) throw new Error(e1.message);
    }
    const { error: e2 } = await service.from("usuarios_perfil").insert({
      user_id: novoId, nome: v.nome, cargo: v.cargo, empresas: v.empresas, criado_por: eu.userId,
    });
    if (e2) throw new Error(e2.message);
    const link = await emitirConvite(novoId);
    revalidatePath("/configuracoes");
    return { ok: true, link };
  } catch (e) {
    await service.auth.admin.deleteUser(novoId); // desfaz: nada fica pela metade
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível criar o usuário." };
  }
}

export async function atualizarUsuario(id: string, entrada: EntradaUsuario): Promise<Resultado> {
  const eu = await exigirSuperAdmin();
  const v = validar(entrada);
  if (typeof v === "string") return { ok: false, erro: v };
  if (id === eu.userId && v.cargo !== "super_admin") {
    return { ok: false, erro: "Você não pode tirar o seu próprio cargo de super admin." };
  }
  const { error } = await createServiceClient()
    .from("usuarios_perfil").update({ nome: v.nome, cargo: v.cargo, empresas: v.empresas }).eq("user_id", id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Novo link: serve para convite que expirou e também para redefinir a senha de quem já entrou. */
export async function gerarLinkUsuario(id: string): Promise<Resultado<{ link: string }>> {
  await exigirSuperAdmin();
  try {
    const link = await emitirConvite(id);
    revalidatePath("/configuracoes");
    return { ok: true, link };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível gerar o link." };
  }
}

export async function definirBloqueio(id: string, bloquear: boolean): Promise<Resultado> {
  const eu = await exigirSuperAdmin();
  if (id === eu.userId) return { ok: false, erro: "Você não pode bloquear a si mesmo." };
  const service = createServiceClient();
  const { error } = await service.from("usuarios_perfil")
    .update({ bloqueado_em: bloquear ? new Date().toISOString() : null }).eq("user_id", id);
  if (error) return { ok: false, erro: error.message };
  await service.auth.admin.updateUserById(id, { ban_duration: bloquear ? "876000h" : "none" });
  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Só remove quem nunca entrou (convite sem uso): quem já usou o sistema tem dados, então só se bloqueia. */
export async function removerUsuario(id: string): Promise<Resultado> {
  const eu = await exigirSuperAdmin();
  if (id === eu.userId) return { ok: false, erro: "Você não pode remover a si mesmo." };
  const service = createServiceClient();
  const { data: p } = await service.from("usuarios_perfil").select("senha_definida_em").eq("user_id", id).maybeSingle();
  if (!p) return { ok: false, erro: "Usuário não encontrado." };
  if (p.senha_definida_em) {
    return { ok: false, erro: "Quem já entrou no sistema não é removido (os dados dele ficariam perdidos). Use Bloquear acesso." };
  }
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/configuracoes");
  return { ok: true };
}
