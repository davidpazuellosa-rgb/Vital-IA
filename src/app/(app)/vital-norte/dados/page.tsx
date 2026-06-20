import { createClient } from "@/lib/supabase/server";
import { EmpresaForm } from "@/components/empresa-form";
import type { EmpresaDados } from "@/lib/empresa/actions";

const VAZIO: EmpresaDados = {
  razao_social: "", nome_fantasia: "", cnpj: "", porte: "", natureza_juridica: "",
  data_abertura: null, cnae_principal: "", inscricao_estadual: "", inscricao_municipal: "",
  email: "", telefone: "", cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", municipio: "", uf: "", dados_bancarios: "",
};

export default async function DadosEmpresaPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("empresa").select("*").maybeSingle();
  const dados: EmpresaDados = { ...VAZIO, ...(data ?? {}) };

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dados da Empresa</h1>
        <p className="text-sm text-muted-foreground">
          Dados cadastrais da Vital Norte, reutilizados para preencher propostas e habilitações.
        </p>
      </div>
      <EmpresaForm dados={dados} />
    </div>
  );
}
