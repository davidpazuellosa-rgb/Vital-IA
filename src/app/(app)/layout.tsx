import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <SidebarProvider style={{ "--sidebar-width": "13rem" } as React.CSSProperties}>
      <AppSidebar userEmail={user.email ?? ""} />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <main className="flex w-full min-w-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto p-4 md:p-6 2xl:px-10">
          {children}
        </main>
      </SidebarInset>
      <Toaster position="top-right" richColors closeButton />
    </SidebarProvider>
  );
}
