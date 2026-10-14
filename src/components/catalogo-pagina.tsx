import { createClient } from "@/lib/supabase/server";
import type { ItemCatalogo } from "@/lib/catalogo/types";
import { Catalogo, FormItem } from "@/components/catalogo-client";
import { configEmpresa, type EmpresaSlug } from "@/lib/empresas";

/** Catálogo de uma empresa (padrão: Vital Norte). A RM usa a tabela própria. */
export async function CatalogoPagina({ empresa }: { empresa?: EmpresaSlug }) {
  const cfg = configEmpresa(empresa);
  const supabase = await createClient();
  const { data } = await supabase.from(cfg.tabelaCatalogo).select("*").order("nome");
  const itens = (data ?? []) as ItemCatalogo[];

  return (
    <div className="flex flex-col gap-5">
      {itens.length > 0 && (
        <div className="flex justify-end">
          <FormItem empresa={empresa} />
        </div>
      )}
      <Catalogo itens={itens} empresa={empresa} />
    </div>
  );
}
