import { createClient } from "@/lib/supabase/server";
import { VitaAjustesClient } from "@/components/vita/vita-ajustes-client";
import { carregarConfig, type Memoria } from "@/lib/vita/memoria";
import type { Avaliacao } from "@/lib/vita/feedback";

export default async function VitaPage() {
  const supabase = await createClient();
  const [config, { data }, { data: avaliacoes }] = await Promise.all([
    carregarConfig(supabase),
    supabase
      .from("vita_memorias")
      .select("id, conteudo, categoria, origem, ativo, created_at, updated_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("vita_feedback")
      .select("id, nota, motivo, pedido, resposta, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return <VitaAjustesClient config={config} memorias={(data ?? []) as Memoria[]} avaliacoes={(avaliacoes ?? []) as Avaliacao[]} />;
}
