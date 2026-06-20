"use client";

import { usePathname } from "next/navigation";
import { Search, Bookmark } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

const TITLES: Record<string, { label: string; icon: typeof Search }> = {
  "/busca": { label: "Busca de Licitações", icon: Search },
  "/minhas-licitacoes": { label: "Minhas Licitações", icon: Bookmark },
};

export function AppHeader() {
  const pathname = usePathname();
  const current = TITLES[pathname] ?? { label: "Vital.IA", icon: Search };
  const Icon = current.icon;

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <span className="text-sm font-semibold">{current.label}</span>
      </div>
    </header>
  );
}
