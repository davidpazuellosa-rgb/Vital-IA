import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { VitaProvider } from "@/components/vita/vita-contexto";
import { VitaPainel } from "@/components/vita/vita-painel";
import { createClient } from "@/lib/supabase/server";
import { obterAcesso } from "@/lib/acesso";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const acesso = await obterAcesso();
  if (!acesso?.cargo) {
    return (
      <div className="flex min-h-svh flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-medium">Sua conta não tem acesso ao sistema</p>
        <p className="text-sm text-muted-foreground">Fale com o administrador.</p>
        <form action={signOut}><Button type="submit" variant="outline">Sair</Button></form>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <VitaProvider>
        <AppSidebar userEmail={user.email ?? ""} empresas={acesso.empresas} />
        <SidebarInset className="min-w-0">
          <AppHeader />
          {/* A Vita fica abaixo da barra do topo, ao lado do conteúdo (empurrando-o). */}
          {/* overflow-x-clip: o painel da Vita (fechado ou expandindo) nunca cria rolagem horizontal na página. */}
          <div className="flex min-w-0 flex-1 overflow-x-clip">
            <main className="flex w-full min-w-0 flex-1 flex-col gap-5 overflow-x-clip p-4 md:p-6 2xl:px-10">
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
