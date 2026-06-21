import { ExternalLink, FileSignature, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ASSINADOR_URL = "https://sso.acesso.gov.br/login?client_id=assinador.iti.br&authorization_id=19eea711b3c";

export default function AssinadorPropostasPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileSignature className="size-6 text-primary" />
            Assinador de Propostas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use o assinador gov.br/ITI para assinar propostas e cadernos de declarações antes de importar os PDFs de volta.
          </p>
        </div>
        <Button asChild>
          <a href={ASSINADOR_URL} target="_blank" rel="noreferrer">
            <ExternalLink />
            Abrir em nova aba
          </a>
        </Button>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <CardTitle className="text-sm">Se o login não carregar aqui dentro</CardTitle>
            <CardDescription>
              O gov.br pode bloquear carregamento em iframe por segurança. Nesse caso, use “Abrir em nova aba”, assine o PDF e depois importe o arquivo assinado na proposta.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <Card className="min-h-[70vh] flex-1 overflow-hidden">
        <CardContent className="h-[72vh] p-0">
          <iframe
            src={ASSINADOR_URL}
            title="Assinador gov.br"
            className="h-full w-full border-0"
            referrerPolicy="no-referrer"
            allow="clipboard-read; clipboard-write"
          />
        </CardContent>
      </Card>
    </div>
  );
}
