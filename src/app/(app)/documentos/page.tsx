import { DocumentosPagina } from "@/components/documentos-pagina";
import { exigirEmpresa } from "@/lib/acesso";

export default async function DocumentosPage() {
  await exigirEmpresa("vital-norte");
  return <DocumentosPagina empresa="vital-norte" />;
}
