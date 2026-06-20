"use client";

import { useActionState, useState } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { signIn, signUp } from "./actions";

type FormState = { error: string } | { success: string } | null;

export default function LoginPage() {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const action = modo === "entrar" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (_prev, formData) => (await action(formData)) ?? null,
    null,
  );

  return (
    <div className="relative flex min-h-svh flex-1 items-center justify-center overflow-hidden p-4">
      {/* Fundo decorativo */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 size-80 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 size-80 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        {/* Marca */}
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/30">
            V
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Vital.IA</h1>
            <p className="text-sm text-muted-foreground">
              Busca inteligente de licitações públicas
            </p>
          </div>
        </div>

        <Card className="shadow-xl shadow-black/5">
          <CardContent className="pt-6">
            {/* Abas segmentadas */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["entrar", "cadastrar"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  className={cn(
                    "rounded-md py-1.5 text-sm font-medium transition-colors",
                    modo === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "entrar" ? "Entrar" : "Cadastrar"}
                </button>
              ))}
            </div>

            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="voce@empresa.com"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              {state && "error" in state && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {state.error}
                </p>
              )}
              {state && "success" in state && (
                <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                  {state.success}
                </p>
              )}

              <Button type="submit" disabled={pending} className="mt-1">
                {pending && <Loader2 className="animate-spin" />}
                {modo === "entrar" ? "Entrar" : "Criar conta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao continuar, você concorda com nossos termos de uso.
        </p>
      </div>
    </div>
  );
}
