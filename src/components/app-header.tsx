"use client";

import { usePathname } from "next/navigation";
import { Search, Bookmark, Settings, FolderOpen, Globe, FileText, Package, Users, Receipt, Bell, FileSignature } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { VitaBotao } from "@/components/vita/vita-botao";

// Do mais específico para o mais genérico (casa pelo começo do caminho).
const TITLES: Array<[string, { label: string; icon: typeof Search }]> = [
  ["/busca", { label: "Busca de Licitações", icon: Search }],
  ["/minhas-licitacoes", { label: "Minhas Licitações", icon: Bookmark }],
  ["/licitacao/pncp", { label: "Busca de Licitações", icon: Search }],
  ["/licitacao", { label: "Minhas Licitações", icon: Bookmark }],
  ["/assinador-propostas", { label: "Assinador de Propostas", icon: FileSignature }],
  ["/documentos", { label: "Documentos", icon: FolderOpen }],
  ["/vital-norte/sistemas", { label: "Sistemas de Licitação", icon: Globe }],
  ["/vital-norte/dados", { label: "Dados da Empresa", icon: FileText }],
  ["/vital-norte/catalogo", { label: "Catálogo de Produtos e Serviços", icon: Package }],
  ["/vital-norte/clientes", { label: "Clientes", icon: Users }],
  ["/vital-norte/nota-fiscal", { label: "Nota Fiscal", icon: Receipt }],
  ["/vital-norte/alertas", { label: "Alertas", icon: Bell }],
  ["/configuracoes", { label: "Configurações", icon: Settings }],
];

export function AppHeader() {
  const pathname = usePathname();
  const current = TITLES.find(([prefixo]) => pathname === prefixo || pathname.startsWith(prefixo + "/"))?.[1] ?? { label: "Vital.IA", icon: Search };
  const Icon = current.icon;

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-semibold">{current.label}</span>
      </div>
      <VitaBotao />
    </header>
  );
}
