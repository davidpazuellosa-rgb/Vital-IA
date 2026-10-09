import { createClient } from "@/lib/supabase/server";
import type { ItemCatalogo } from "@/lib/catalogo/types";
import { Catalogo, FormItem } from "@/components/catalogo-client";

export default async function CatalogoPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("catalogo_itens").select("*").order("nome");
  const itens = (data ?? []) as ItemCatalogo[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo de Produtos e Serviços</h1>
        {itens.length > 0 && <FormItem />}
      </div>
      <Catalogo itens={itens} />
    </div>
  );
}
