import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DadosEmpresaPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dados da Empresa</h1>
        <p className="text-sm text-muted-foreground">
          Dados cadastrais da Vital Norte usados para preencher propostas e habilitações.
        </p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">Em breve</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Aqui ficarão CNPJ, razão social, endereço, dados bancários e sócios — reutilizados
              automaticamente na geração de propostas.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
