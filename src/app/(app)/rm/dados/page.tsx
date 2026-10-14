import { createClient } from "@/lib/supabase/server";
import { EmpresaForm } from "@/components/empresa-form";
import type { EmpresaDados } from "@/lib/empresa/actions";
import { EMPRESAS } from "@/lib/empresas";

const VAZIO: EmpresaDados = {
  razao_social: "", nome_fantasia: "", cnpj: "", porte: "", natureza_juridica: "",
  data_abertura: null, cnae_principal: "", inscricao_estadual: "", inscricao_municipal: "",
  email: "", telefone: "", cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", municipio: "", uf: "", dados_bancarios: "",
};

/** Dados da empresa RM (tabela própria). Sem a parte de propostas: a RM não tem propostas. */
export default async function RmDadosPage() {
  const supabase = await createClient();
  const { data } = await supabase.from(EMPRESAS.rm.tabelaEmpresa).select("*").maybeSingle();
  return (
    <div className="flex flex-col gap-5">
      <EmpresaForm dados={{ ...VAZIO, ...(data ?? {}) }} empresa="rm" />
    </div>
  );
}
