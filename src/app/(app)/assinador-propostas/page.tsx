import { CheckCircle2, Download, ExternalLink, FileSignature, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ASSINADOR_URL = "https://sso.acesso.gov.br/login?client_id=assinador.iti.br&authorization_id=19eea711b3c";
const ETAPAS = [
  {
    titulo: "1. Baixe o PDF no Vital.IA",
    icon: Download,
  },
  {
    titulo: "2. Abra o Assinador gov.br",
    icon: ExternalLink,
  },
  {
    titulo: "3. Assine com sua conta gov.br",
    icon: FileSignature,
  },
  {
    titulo: "4. Importe o PDF assinado",
    icon: Upload,
  },
];

export default function AssinadorPropostasPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex md:justify-end">
        <Button asChild size="lg">
          <a href={ASSINADOR_URL} target="_blank" rel="noreferrer">
            <ExternalLink />
            Abrir Assinador gov.br
          </a>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ETAPAS.map((etapa) => (
          <Card key={etapa.titulo}>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <etapa.icon className="size-5" />
              </div>
              <CardTitle className="text-base">{etapa.titulo}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="flex-1 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-primary" />
            Fluxo recomendado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg">
            <a href={ASSINADOR_URL} target="_blank" rel="noreferrer">
              <ExternalLink />
              Abrir Assinador gov.br agora
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
