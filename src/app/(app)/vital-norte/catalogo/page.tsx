import { createClient } from "@/lib/supabase/server";
import type { ItemCatalogo } from "@/lib/catalogo/types";
import { Catalogo, FormItem } from "@/components/catalogo-client";

export default async function CatalogoPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("catalogo_itens").select("*").order("nome");
  const itens = (data ?? []) as ItemCatalogo[];

  return (
    <div className="flex flex-col gap-5">
      {itens.length > 0 && (
        <div className="flex justify-end">
          <FormItem />
        </div>
      )}
      <Catalogo itens={itens} />
    </div>
  );
}
