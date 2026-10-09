import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { VitaProvider } from "@/components/vita/vita-contexto";
import { VitaPainel } from "@/components/vita/vita-painel";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <VitaProvider>
        <AppSidebar userEmail={user.email ?? ""} />
        <SidebarInset className="min-w-0">
          <AppHeader />
          {/* A Vita fica abaixo da barra do topo, ao lado do conteúdo (empurrando-o). */}
          {/* overflow-x-clip: o painel da Vita (fechado ou expandindo) nunca cria rolagem horizontal na página. */}
          <div className="flex min-w-0 flex-1 overflow-x-clip">
            <main className="flex w-full min-w-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto p-4 md:p-6 2xl:px-10">
              {children}
            </main>
            <VitaPainel />
          </div>
        </SidebarInset>
      </VitaProvider>
      <Toaster position="top-right" richColors closeButton />
    </SidebarProvider>
  );
}
