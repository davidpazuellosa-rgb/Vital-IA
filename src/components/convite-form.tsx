"use client";

import { useActionState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { definirSenhaConvite } from "@/lib/usuarios/convite-actions";
import { MIN_SENHA } from "@/lib/usuarios/tipos";

export function ConviteForm({ token, email, nome }: { token: string; email: string; nome: string }) {
  const [state, formAction, pending] = useActionState<{ erro: string } | null, FormData>(
    async (_prev, fd) => (await definirSenhaConvite(token, String(fd.get("senha") ?? ""), String(fd.get("confirmar") ?? ""))) ?? null,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-center font-medium">{nome ? `Olá, ${nome}. Crie a sua senha` : "Crie a sua senha"}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="email" value={email} readOnly disabled className="pl-9" autoComplete="username" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="senha">Senha</Label>
        <PasswordInput id="senha" name="senha" required minLength={MIN_SENHA} autoComplete="new-password" placeholder="••••••••" leftIcon={<Lock />} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmar">Confirmar senha</Label>
        <PasswordInput id="confirmar" name="confirmar" required minLength={MIN_SENHA} autoComplete="new-password" placeholder="••••••••" leftIcon={<Lock />} />
      </div>
      {state?.erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.erro}</p>}
      <Button type="submit" disabled={pending} className="mt-1">
        {pending && <Loader2 className="animate-spin" />}
        Salvar senha e entrar
      </Button>
    </form>
  );
}
