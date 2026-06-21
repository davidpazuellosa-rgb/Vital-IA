"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Bookmark, FolderOpen, LogOut, Building2, ChevronRight, FileSignature, FileText, Users, Bell } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOut } from "@/app/login/actions";

const NAV_ITEMS = [
  { href: "/busca", label: "Busca", icon: Search },
  { href: "/minhas-licitacoes", label: "Minhas Licitações", icon: Bookmark },
  { href: "/assinador-propostas", label: "Assinador de Propostas", icon: FileSignature },
];

const VITAL_NORTE_ITEMS = [
  { href: "/documentos", label: "Documentos", icon: FolderOpen },
  { href: "/vital-norte/dados", label: "Dados da Empresa", icon: FileText },
  { href: "/vital-norte/clientes", label: "Clientes", icon: Users },
  { href: "/vital-norte/alertas", label: "Alertas", icon: Bell },
];

export function AppSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const iniciais = (userEmail.slice(0, 2) || "U").toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <div className="flex items-center gap-2.5 px-1.5 py-2">
          <div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-base font-bold shadow-sm shadow-primary/30">
            V
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-semibold tracking-tight">Vital.IA</span>
            <span className="text-xs text-sidebar-foreground/60">Licitações públicas</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Seção recolhível Vital Norte */}
              <Collapsible defaultOpen className="group/vn">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Vital Norte">
                      <Building2 />
                      <span>Vital Norte</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/vn:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {VITAL_NORTE_ITEMS.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild isActive={pathname === item.href}>
                            <Link href={item.href}>
                              <item.icon />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60">
        <div className="flex items-center gap-2 px-1.5 py-1.5 group-data-[collapsible=icon]:hidden">
          <Avatar className="size-8">
            <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
              {iniciais}
            </AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground/70">
            {userEmail}
          </span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signOut}>
              <SidebarMenuButton type="submit" tooltip="Sair">
                <LogOut />
                <span>Sair</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
