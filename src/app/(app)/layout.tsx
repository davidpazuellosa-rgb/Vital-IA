import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <SidebarProvider style={{ "--sidebar-width": "13rem" } as React.CSSProperties}>
      <AppSidebar userEmail={user.email ?? ""} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium text-muted-foreground">
            Busca de Licitações
          </span>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
