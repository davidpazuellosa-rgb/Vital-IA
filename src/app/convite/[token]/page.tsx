import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConviteForm } from "@/components/convite-form";
import { consultarConvite } from "@/lib/usuarios/convite-actions";

export const metadata = { title: "Criar senha — Vital.IA" };

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const convite = await consultarConvite(token);

  return (
    <div className="relative flex min-h-svh flex-1 items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/30">
            V
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Vital.IA</h1>
        </div>
        <Card className="shadow-xl shadow-black/5">
          <CardContent className="pt-6">
            {convite ? (
              <ConviteForm token={token} email={convite.email} nome={convite.nome} />
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="font-medium">Este link não vale mais</p>
                <p className="text-sm text-muted-foreground">Peça um novo link ao administrador.</p>
                <Button asChild variant="outline"><Link href="/login">Ir para o login</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
