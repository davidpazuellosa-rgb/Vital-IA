"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { MIN_SENHA } from "./tipos";

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export type ConviteInfo = { email: string; nome: string } | null;

/** Dados de um convite válido (existe, não expirou, conta não bloqueada); senão null. */
export async function consultarConvite(token: string): Promise<ConviteInfo> {
  if (!token || token.length < 20) return null;
  const service = createServiceClient();
  const { data: p } = await service.from("usuarios_perfil")
    .select("user_id, nome, convite_expira_em, bloqueado_em")
    .eq("convite_hash", hashToken(token)).maybeSingle();
  if (!p || p.bloqueado_em || !p.convite_expira_em || new Date(p.convite_expira_em).getTime() < Date.now()) return null;
  const { data: u } = await service.auth.admin.getUserById(p.user_id);
  if (!u.user?.email) return null;
  return { email: u.user.email, nome: p.nome ?? "" };
}

/** Cadastra a senha escolhida, invalida o link e já entra no sistema. */
export async function definirSenhaConvite(token: string, senha: string, confirmar: string): Promise<{ erro: string } | void> {
  if (senha.length < MIN_SENHA) return { erro: `A senha precisa ter pelo menos ${MIN_SENHA} caracteres.` };
  if (senha !== confirmar) return { erro: "As senhas não são iguais." };

  const service = createServiceClient();
  const { data: p } = await service.from("usuarios_perfil")
    .select("user_id, convite_expira_em, bloqueado_em")
    .eq("convite_hash", hashToken(token)).maybeSingle();
  if (!p || p.bloqueado_em || !p.convite_expira_em || new Date(p.convite_expira_em).getTime() < Date.now()) {
    return { erro: "Este link não vale mais. Peça um novo ao administrador." };
  }

  const { data: u, error } = await service.auth.admin.updateUserById(p.user_id, { password: senha, email_confirm: true });
  if (error || !u.user?.email) return { erro: error?.message ?? "Não foi possível salvar a senha." };

  await service.from("usuarios_perfil")
    .update({ convite_hash: null, convite_expira_em: null, senha_definida_em: new Date().toISOString() })
    .eq("user_id", p.user_id);

  const supabase = await createClient();
  const { error: e2 } = await supabase.auth.signInWithPassword({ email: u.user.email, password: senha });
  if (e2) redirect("/login");
  redirect("/busca");
}
