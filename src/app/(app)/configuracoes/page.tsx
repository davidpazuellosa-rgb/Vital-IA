import Link from "next/link";
import { Bell, Building2, FileText, FolderOpen, Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CONFIGURACOES = [
  {
    titulo: "Dados da empresa",
    descricao: "Cadastro da Vital Norte usado em propostas, declarações e documentos.",
    href: "/vital-norte/dados",
    icon: Building2,
  },
  {
    titulo: "Documentos",
    descricao: "Certidões e arquivos de habilitação usados na análise das propostas.",
    href: "/documentos",
    icon: FolderOpen,
  },
  {
    titulo: "Alertas",
    descricao: "Filtros automáticos e canais de notificação, como Telegram, WhatsApp e e-mail.",
    href: "/vital-norte/alertas",
    icon: Bell,
  },
  {
    titulo: "Propostas",
    descricao: "Padrões de representantes, validade e observações das propostas.",
    href: "/vital-norte/dados",
    icon: FileText,
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Configurações gerais</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ajustes centrais do sistema e atalhos para as configurações operacionais.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {CONFIGURACOES.map((item) => (
          <Card key={item.titulo} className="shadow-sm">
            <CardContent className="flex h-full flex-col gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <item.icon className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">{item.titulo}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.descricao}</p>
              </div>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={item.href}>Abrir configuração</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
