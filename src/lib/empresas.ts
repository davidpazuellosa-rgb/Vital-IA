/* Empresas do sistema. A Vital Norte é a principal (tudo o que já existia). A RM tem TABELAS PRÓPRIAS
 * só para Documentos, Dados da Empresa e Catálogo, totalmente separadas das da Vital Norte.
 * Toda função que aceita um `EmpresaSlug` assume "vital-norte" quando ele não é informado: o
 * comportamento antigo continua exatamente igual. Seguro para servidor e navegador. */

export type EmpresaSlug = "vital-norte" | "rm";

export type ConfigEmpresa = {
  slug: EmpresaSlug;
  nome: string;
  tabelaDocumentos: string;
  tabelaEmpresa: string;
  tabelaCatalogo: string;
  /** Prefixo da pasta no storage, depois de `<empresa_user_id>/` ("" para a Vital Norte). */
  pastaStorage: string;
  rotaDocumentos: string;
  rotaDados: string;
  rotaCatalogo: string;
};

export const EMPRESAS: Record<EmpresaSlug, ConfigEmpresa> = {
  "vital-norte": {
    slug: "vital-norte", nome: "Vital Norte",
    tabelaDocumentos: "documentos", tabelaEmpresa: "empresa", tabelaCatalogo: "catalogo_itens", pastaStorage: "",
    rotaDocumentos: "/documentos", rotaDados: "/vital-norte/dados", rotaCatalogo: "/vital-norte/catalogo",
  },
  rm: {
    slug: "rm", nome: "RM",
    tabelaDocumentos: "rm_documentos", tabelaEmpresa: "rm_empresa", tabelaCatalogo: "rm_catalogo_itens", pastaStorage: "rm/",
    rotaDocumentos: "/rm/documentos", rotaDados: "/rm/dados", rotaCatalogo: "/rm/catalogo",
  },
};

export const ehEmpresaSlug = (v: unknown): v is EmpresaSlug => v === "vital-norte" || v === "rm";

/** Configuração da empresa; valor desconhecido ou ausente = Vital Norte. */
export const configEmpresa = (slug?: unknown): ConfigEmpresa => (ehEmpresaSlug(slug) ? EMPRESAS[slug] : EMPRESAS["vital-norte"]);
