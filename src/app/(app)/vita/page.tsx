import { createClient } from "@/lib/supabase/server";
import { VitaAjustesClient } from "@/components/vita/vita-ajustes-client";
import { carregarConfig, type Memoria } from "@/lib/vita/memoria";

export default async function VitaPage() {
  const supabase = await createClient();
  const [config, { data }] = await Promise.all([
    carregarConfig(supabase),
    supabase
      .from("vita_memorias")
      .select("id, conteudo, categoria, origem, ativo, created_at, updated_at")
      .order("created_at", { ascending: false }),
  ]);
  return <VitaAjustesClient config={config} memorias={(data ?? []) as Memoria[]} />;
}
