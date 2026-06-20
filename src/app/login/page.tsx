"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex flex-1 items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Vital.IA</CardTitle>
          <CardDescription>
            {modo === "entrar" ? "Entre na sua conta" : "Crie sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>
            {state && "error" in state && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            {state && "success" in state && (
              <p className="text-sm text-emerald-600">{state.success}</p>
            )}
            <Button type="submit" disabled={pending}>
              {modo === "entrar" ? "Entrar" : "Cadastrar"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:underline"
          >
            {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
