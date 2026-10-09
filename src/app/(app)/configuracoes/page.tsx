import Link from "next/link";
import { Bell, Building2, FileText, FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CONFIGURACOES = [
  {
    titulo: "Dados da empresa",
    href: "/vital-norte/dados",
    icon: Building2,
  },
  {
    titulo: "Documentos",
    href: "/documentos",
    icon: FolderOpen,
  },
  {
    titulo: "Alertas",
    href: "/vital-norte/alertas",
    icon: Bell,
  },
  {
    titulo: "Propostas",
    href: "/vital-norte/dados",
    icon: FileText,
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {CONFIGURACOES.map((item) => (
          <Card key={item.titulo} className="shadow-sm">
            <CardContent className="flex h-full flex-col gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <item.icon className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">{item.titulo}</h2>
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
