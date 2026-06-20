import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ClientesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cada cliente reúne seus contratos, notas fiscais e propostas.
        </p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Em breve</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Aqui você cadastrará os clientes e, dentro de cada um, os contratos firmados, as
              notas fiscais emitidas e as propostas enviadas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
