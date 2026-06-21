import { CheckCircle2, Download, ExternalLink, FileSignature, ShieldAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ASSINADOR_URL = "https://sso.acesso.gov.br/login?client_id=assinador.iti.br&authorization_id=19eea711b3c";
const ETAPAS = [
  {
    titulo: "1. Baixe o PDF no Vital.IA",
    descricao: "Na proposta, baixe o caderno de declarações ou a proposta final que precisa ser assinada.",
    icon: Download,
  },
  {
    titulo: "2. Abra o Assinador gov.br",
    descricao: "Use o botão desta página para abrir o assinador em uma aba segura do navegador.",
    icon: ExternalLink,
  },
  {
    titulo: "3. Assine com sua conta gov.br",
    descricao: "Envie o PDF no Assinador, conclua a autenticação e baixe o arquivo assinado.",
    icon: FileSignature,
  },
  {
    titulo: "4. Importe o PDF assinado",
    descricao: "Volte para a proposta no Vital.IA e use “Importar assinado” para anexar o documento final.",
    icon: Upload,
  },
];

export default function AssinadorPropostasPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileSignature className="size-6 text-primary" />
            Assinador de Propostas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use o assinador gov.br/ITI para assinar propostas e cadernos de declarações antes de importar os PDFs de volta.
          </p>
        </div>
        <Button asChild size="lg" className="md:mt-1">
          <a href={ASSINADOR_URL} target="_blank" rel="noreferrer">
            <ExternalLink />
            Abrir Assinador gov.br
          </a>
        </Button>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <CardTitle className="text-sm">Por que não fica embutido aqui dentro?</CardTitle>
            <CardDescription>
              O gov.br bloqueia iframe por segurança usando políticas como <span className="font-mono">frame-ancestors &apos;none&apos;</span> e <span className="font-mono">X-Frame-Options</span>. Por isso, o fluxo seguro é abrir o Assinador em aba própria e importar o PDF assinado de volta.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ETAPAS.map((etapa) => (
          <Card key={etapa.titulo}>
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <etapa.icon className="size-5" />
              </div>
              <CardTitle className="text-base">{etapa.titulo}</CardTitle>
              <CardDescription>{etapa.descricao}</CardDescription>
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
          <CardDescription>
            Deixe esta página aberta como painel de apoio. Abra o Assinador gov.br em nova aba, conclua a assinatura e depois volte para a proposta para importar o PDF assinado. Assim evitamos qualquer gambiarra com login gov.br e mantemos o processo seguro.
          </CardDescription>
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
