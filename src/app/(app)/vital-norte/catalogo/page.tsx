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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catálogo de Produtos e Serviços</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            O que a empresa vende, com custo, preço de referência e margem. {itens.length > 0 && `${itens.length} item(ns).`}
          </p>
        </div>
        {itens.length > 0 && <FormItem />}
      </div>
      <Catalogo itens={itens} />
    </div>
  );
}
