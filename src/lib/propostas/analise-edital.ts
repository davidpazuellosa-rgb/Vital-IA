import { avaliarValidade, type Documento } from "@/lib/documentos/types";
import type { ArquivoEditalLido } from "@/lib/licitacoes/providers/pncp-arquivos";
import type { LicitacaoItem } from "@/lib/licitacoes/types";

export type StatusRequisito = "disponivel" | "faltante" | "vencido" | "a_gerar";

export type RequisitoEdital = {
  nome: string;
  tipoDocumento: string | null;
  status: StatusRequisito;
  origem: string;
  trecho: string;
};

export type AnaliseEdital = {
  analisadoEm: string;
  cobertura: {
    totalArquivos: number;
    arquivosLidos: number;
    paginasLidas: number;
    leituraCompleta: boolean;
  };
  arquivos: Array<{
    sequencial: number;
    titulo: string;
    tipo: string;
    status: ArquivoEditalLido["status"];
    paginas: number;
  }>;
  documentos: RequisitoEdital[];
  declaracoes: RequisitoEdital[];
  condicoes: Array<{ nome: string; trecho: string; origem: string }>;
  itens: LicitacaoItem[];
  alertas: string[];
};

type DefinicaoDocumento = {
  tipo: string;
  nome: string;
  padrao: RegExp;
};

const DOCUMENTOS_EXIGIVEIS: DefinicaoDocumento[] = [
  { tipo: "cnd_federal", nome: "CND Federal", padrao: /certid[aã]o.{0,90}(federal|d[ií]vida ativa|fazenda nacional)|regularidade.{0,80}federal/i },
  { tipo: "fgts", nome: "CRF / FGTS", padrao: /(regularidade.{0,40}fgts|certificado.{0,40}fgts|fundo de garantia)/i },
  { tipo: "trabalhista", nome: "CNDT", padrao: /(certid[aã]o.{0,70}d[ée]bitos trabalhistas|cndt|regularidade trabalhista)/i },
  { tipo: "estadual", nome: "Certidão Estadual", padrao: /certid[aã]o.{0,70}(estadual|fazenda do estado)|regularidade.{0,70}estadual/i },
  { tipo: "municipal", nome: "Certidão Municipal", padrao: /certid[aã]o.{0,70}(municipal|fazenda municipal)|regularidade.{0,70}municipal/i },
  { tipo: "contrato_social", nome: "Contrato Social", padrao: /(contrato social|ato constitutivo|estatuto social)/i },
  { tipo: "cnpj", nome: "Cartão CNPJ", padrao: /(cart[aã]o.{0,20}cnpj|comprovante.{0,70}(cnpj|cadastro nacional)|inscri[cç][aã]o no cnpj)/i },
  { tipo: "inscricao_estadual", nome: "Inscrição Estadual", padrao: /comprovante.{0,60}inscri[cç][aã]o estadual/i },
  { tipo: "inscricao_municipal", nome: "Inscrição Municipal", padrao: /comprovante.{0,60}inscri[cç][aã]o municipal/i },
  { tipo: "falencia", nome: "Falência e Concordata", padrao: /certid[aã]o.{0,80}(fal[êe]ncia|recupera[cç][aã]o judicial|concordata)/i },
  { tipo: "balanco", nome: "Balanço Patrimonial", padrao: /(balan[cç]o patrimonial|demonstra[cç][oõ]es cont[aá]beis)/i },
  { tipo: "atestado_capacidade_tecnica", nome: "Atestado de Capacidade Técnica", padrao: /(atestado|certid[aã]o).{0,80}capacidade t[ée]cnica|comprova[cç][aã]o.{0,80}aptid[aã]o/i },
  { tipo: "decl_enquadramento", nome: "Declaração de enquadramento ME/EPP", padrao: /declara[cç][aã]o.{0,100}(enquadramento|microempresa|empresa de pequeno porte|me\/epp)/i },
  { tipo: "decl_nao_emprega_menor", nome: "Declaração de que não emprega menor", padrao: /declara[cç][aã]o.{0,120}(n[aã]o emprega|trabalho).{0,50}menor/i },
  { tipo: "decl_nepotismo", nome: "Declaração negativa de nepotismo", padrao: /declara[cç][aã]o.{0,80}nepotismo/i },
];

const DECLARACOES_ESPECIFICAS = [
  { nome: "Declaração de atendimento ao edital / Termo de Referência", padrao: /declara[cç][aã]o.{0,120}(atendimento|cumprimento|concord[aâ]ncia).{0,80}(edital|termo de refer[êe]ncia|requisitos)/i },
  { nome: "Declaração de inexistência de fato impeditivo", padrao: /declara[cç][aã]o.{0,100}(fato impeditivo|inidoneidade)/i },
  { nome: "Declaração de proposta independente", padrao: /declara[cç][aã]o.{0,80}(proposta independente|elabora[cç][aã]o independente)/i },
  { nome: "Declaração sobre trabalho escravo e discriminação", padrao: /declara[cç][aã]o.{0,120}(trabalho escravo|an[aá]loga.{0,20}escravo|discrimina[cç][aã]o)/i },
  { nome: "Declaração de reserva de cargos para PCD", padrao: /declara[cç][aã]o.{0,120}(pessoa com defici[êe]ncia|reserva de cargos|reabilitado)/i },
  { nome: "Declaração de integralidade dos custos", padrao: /declara[cç][aã]o.{0,120}(integralidade|custos trabalhistas|direitos trabalhistas)/i },
  { nome: "Declaração de vistoria ou renúncia", padrao: /declara[cç][aã]o.{0,100}(vistoria|ren[uú]ncia.{0,30}vistoria)/i },
] as const;

const CONDICOES = [
  { nome: "Validade da proposta", padrao: /(?:prazo de )?validade da proposta/i },
  { nome: "Prazo de entrega / execução", padrao: /prazo de (?:entrega|execu[cç][aã]o)/i },
  { nome: "Condições de pagamento", padrao: /(?:prazo|condi[cç][oõ]es?) de pagamento/i },
  { nome: "Local de entrega / execução", padrao: /local de (?:entrega|execu[cç][aã]o)/i },
  { nome: "Garantia", padrao: /prazo de garantia|garantia (?:m[ií]nima|contratual)/i },
] as const;

export function analisarConteudoEdital({
  arquivos,
  documentosEmpresa,
  itens,
}: {
  arquivos: ArquivoEditalLido[];
  documentosEmpresa: Documento[];
  itens: LicitacaoItem[];
}): AnaliseEdital {
  const lidos = arquivos.filter((arquivo) => arquivo.status === "lido");
  const porTipo = new Map<string, Documento>();
  for (const documento of documentosEmpresa) {
    if (!porTipo.has(documento.tipo)) porTipo.set(documento.tipo, documento);
  }

  const documentos: RequisitoEdital[] = [];
  for (const definicao of DOCUMENTOS_EXIGIVEIS) {
    const achado = localizarPadrao(lidos, definicao.padrao);
    if (!achado) continue;
    const documento = porTipo.get(definicao.tipo);
    const validade = documento ? avaliarValidade(documento.data_validade) : null;
    documentos.push({
      nome: definicao.nome,
      tipoDocumento: definicao.tipo,
      status: !documento ? "faltante" : validade?.status === "vencido" ? "vencido" : "disponivel",
      origem: achado.origem,
      trecho: achado.trecho,
    });
  }
  adicionarDocumentosGenericos(documentos, lidos, documentosEmpresa);

  const declaracoes: RequisitoEdital[] = [];
  for (const definicao of DECLARACOES_ESPECIFICAS) {
    const achado = localizarPadrao(lidos, definicao.padrao);
    if (!achado) continue;
    declaracoes.push({ nome: definicao.nome, tipoDocumento: null, status: "a_gerar", ...achado });
  }
  adicionarDeclaracoesGenericas(declaracoes, lidos);

  const condicoes = CONDICOES.flatMap((definicao) => {
    const achado = localizarPadrao(lidos, definicao.padrao);
    return achado ? [{ nome: definicao.nome, ...achado }] : [];
  });

  const alertas: string[] = [];
  if (arquivos.length === 0) alertas.push("Nenhum arquivo foi publicado no PNCP para esta contratação.");
  const semLeitura = arquivos.filter((arquivo) => arquivo.status !== "lido");
  if (semLeitura.length > 0) {
    alertas.push(`${semLeitura.length} arquivo(s) não puderam ser lidos integralmente. Revise-os manualmente antes de enviar a proposta.`);
  }
  if (itens.length === 0) alertas.push("O PNCP não retornou itens para esta contratação.");

  return {
    analisadoEm: new Date().toISOString(),
    cobertura: {
      totalArquivos: arquivos.length,
      arquivosLidos: lidos.length,
      paginasLidas: lidos.reduce((total, arquivo) => total + arquivo.paginas, 0),
      leituraCompleta: arquivos.length > 0 && arquivos.length === lidos.length,
    },
    arquivos: arquivos.map(({ sequencial, titulo, tipo, status, paginas }) => ({ sequencial, titulo, tipo, status, paginas })),
    documentos,
    declaracoes,
    condicoes,
    itens,
    alertas,
  };
}

function adicionarDocumentosGenericos(
  requisitos: RequisitoEdital[],
  arquivos: ArquivoEditalLido[],
  documentosEmpresa: Documento[],
) {
  const palavrasDocumento = /(certid[aã]o|certificado|licen[cç]a|alvar[aá]|registro|comprovante|atestado|autoriza[cç][aã]o)/i;
  const contextoExigencia = /(dever[aá]|dever[aã]o|apresentar|exigid[oa]|habilita[cç][aã]o|comprovar)/i;
  const vistos = new Set(requisitos.map((item) => normalizar(item.nome)));

  for (const arquivo of arquivos) {
    for (const linhaOriginal of arquivo.texto.split(/\n+/)) {
      const linha = linhaOriginal.replace(/\s+/g, " ").trim();
      if (linha.length < 20 || linha.length > 240 || !palavrasDocumento.test(linha) || !contextoExigencia.test(linha)) continue;
      const chave = normalizar(linha);
      if ([...vistos].some((visto) => similar(visto, chave))) continue;

      const documento = documentosEmpresa.find((item) => similar(normalizar(item.nome), chave));
      const validade = documento ? avaliarValidade(documento.data_validade) : null;
      requisitos.push({
        nome: linha.length > 150 ? `${linha.slice(0, 147)}...` : linha,
        tipoDocumento: documento?.tipo ?? null,
        status: !documento ? "faltante" : validade?.status === "vencido" ? "vencido" : "disponivel",
        origem: arquivo.titulo,
        trecho: linha,
      });
      vistos.add(chave);
      if (requisitos.length >= 40) return;
    }
  }
}

function adicionarDeclaracoesGenericas(
  declaracoes: RequisitoEdital[],
  arquivos: ArquivoEditalLido[],
) {
  const vistos = new Set(declaracoes.map((item) => normalizar(item.nome)));
  for (const arquivo of arquivos) {
    for (const linhaOriginal of arquivo.texto.split(/\n+/)) {
      const linha = linhaOriginal.replace(/\s+/g, " ").trim();
      if (linha.length < 15 || linha.length > 220 || !/declara[cç][aã]o/i.test(linha)) continue;
      const declaracao = linha.slice(Math.max(0, linha.search(/declara[cç][aã]o/i))).trim();
      const chave = normalizar(declaracao);
      if ([...vistos].some((visto) => similar(visto, chave))) continue;
      declaracoes.push({
        nome: declaracao.length > 140 ? `${declaracao.slice(0, 137)}...` : declaracao,
        tipoDocumento: null,
        status: "a_gerar",
        origem: arquivo.titulo,
        trecho: linha,
      });
      vistos.add(chave);
      if (declaracoes.length >= 30) return;
    }
  }
}

const PALAVRAS_IGNORADAS = new Set(["para", "com", "sem", "uma", "que", "dos", "das", "dever", "apresentar", "documento", "declaracao"]);

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function similar(a: string, b: string): boolean {
  const palavrasA = a.split(" ").filter((palavra) => palavra.length >= 4 && !PALAVRAS_IGNORADAS.has(palavra));
  if (palavrasA.length === 0) return false;
  const palavrasB = new Set(b.split(" "));
  const comuns = palavrasA.filter((palavra) => palavrasB.has(palavra)).length;
  return comuns / palavrasA.length >= 0.6;
}

function localizarPadrao(
  arquivos: ArquivoEditalLido[],
  padrao: RegExp,
): { origem: string; trecho: string } | null {
  for (const arquivo of arquivos) {
    const texto = arquivo.texto.replace(/\s+/g, " ");
    const correspondencia = padrao.exec(texto);
    if (!correspondencia || correspondencia.index == null) continue;
    const inicio = Math.max(0, correspondencia.index - 100);
    const fim = Math.min(texto.length, correspondencia.index + correspondencia[0].length + 180);
    return { origem: arquivo.titulo, trecho: texto.slice(inicio, fim).trim() };
  }
  return null;
}
