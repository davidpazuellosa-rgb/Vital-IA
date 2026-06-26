# Plano de integração NF-e (modelo 55) — SEFAZ-AM, zero rejeição

Documento de planejamento. **Nada aqui foi executado.** Escopo: NF-e de **bens/mercadorias** (modelo 55), **não** NFS-e. Emitente **Simples Nacional**, em Manaus/AM. Operações: interna AM, interestadual, com incentivo Zona Franca/SUFRAMA e para órgãos públicos.

> ⚠️ Validar antes do go-live: (1) URLs atuais dos web services da SEFAZ-AM no Portal Nacional da NF-e; (2) enquadramento fiscal (CFOP/CSOSN/ZFM) com a contabilidade. O restante é estável.

## 1. Recomendação de integração: manter provedor (Focus NFe)
Integração direta com a SEFAZ-AM (SOAP + assinatura XMLDSig + schemas XSD + contingência) tem a maior chance de erro e manutenção alta. O provedor já resolve assinatura, schema 4.00, transmissão, contingência e Notas Técnicas. Já temos Focus no código (`src/lib/nota-fiscal/focus.ts`, isolado) — o esforço é enriquecer o payload. PlugNotas é a alternativa mais forte para campos de ZFM, se necessário; trocar é fácil por causa do isolamento.

## 2. Pré-requisitos (Fase 0 — negócio)
- Credenciamento NF-e do CNPJ na SEFAZ-AM + Inscrição Estadual ativa.
- Certificado **A1 e-CNPJ** (ICP-Brasil) — A1 é o correto para servidor/automação; subir no painel do provedor.
- Emitir primeiro em **homologação** (`FOCUS_NFE_BASE_URL=https://homologacao.focusnfe.com.br`).

## 3. SEFAZ-AM técnico
- AM é **autorizador próprio** (não usa SVRS). Layout **NF-e 4.00**.
- Contingência do AM = **SVC-RS** (feita automaticamente pelo provedor).
- Confirmar URLs de produção/homologação no Portal Nacional da NF-e (Web Services).

## 4. Parametrizar `montarPayloadFocus` por tipo de operação
Hoje o payload fixa CSOSN 102 / PIS-COFINS 07. Precisa variar por operação:

| Operação | CFOP típico | CSOSN | Pontos críticos |
|---|---|---|---|
| Interna AM | 5101/5102 | 102 (500 se ST) | base atual cobre |
| Interestadual | 6101/6102 | 102 | DIFAL a consumidor final não-contribuinte; regra própria do Simples (confirmar) |
| ZFM/SUFRAMA | 6109/6110 | 103/300 | ICMS desonerado + campos SUFRAMA (§5) |
| Órgão público | 5101/6101 | 102 | `indIEDest=9`, `xPed`/`infAdic` com PROAD/NE |

## 5. ZFM/SUFRAMA — maior fonte de rejeição
Campos ausentes hoje que precisam entrar:
- `vICMSDeson` (valor do ICMS desonerado) + `motDesICMS=7` (SUFRAMA).
- Inscrição SUFRAMA do destinatário + indicador de operação ZFM.
- Abatimento do ICMS no valor (desconto ZFM); PIS/COFINS frequentemente alíquota zero (CST 06).

🔴 **Pendência que muda o tratamento fiscal**: a Vital Norte está em Manaus. CFOP 6109/6110 é para mercadoria **entrando** na ZFM vinda de **outro estado**; venda interna em Manaus normalmente **não** usa esse benefício. Confirmar com a contabilidade se "com incentivo ZFM" é:
- (a) saída para áreas de livre comércio / Amazônia Ocidental, ou
- (b) incentivo industrial local (PPB).

O tratamento difere em cada caso.

## 6. Checklist anti-rejeição (cStat comuns)
- [ ] NCM válido com 8 dígitos; CEST quando houver ST.
- [ ] CFOP × CSOSN compatíveis.
- [ ] IE do destinatário válida / `indIEDest` correto (evita 207–229).
- [ ] `dhEmi` sem atraso (evita 228/703); sem duplicidade de chave (204/539).
- [ ] Certificado válido e CNPJ credenciado (evita 280/281).
- [ ] Falha de schema 215/225 → payload completo conforme layout 4.00.

## 7. Eventos pós-autorização — já implementados (Fase 3)
- Cancelamento (justificativa 15–255) e CC-e (15–1000) prontos no código.
- Confirmar o prazo de cancelamento específico do AM.

## 8. Próximos passos no código (não executados)
1. Tornar `montarPayloadFocus` dirigido por tipo de operação (interna/interestadual/ZFM/órgão).
2. Adicionar campos de destinatário SUFRAMA + desoneração de ICMS no schema/migration, no tipo e no formulário.
3. Tabela de CFOP/CSOSN por operação.
4. (Opcional) seletor de "tipo de operação" no formulário de emissão para dirigir os defaults fiscais.

## Estado atual do módulo (já no repo, branch `feat/nota-fiscal`)
- Fase 1: emissão (rascunho → emitir → polling).
- Fase 2: webhook de status, detalhe, vínculo com contratação, anexar DANFE/XML.
- Fase 3: cancelamento, carta de correção (CC-e), indicador de homologação.
- Pendente: aplicar migrations no Supabase do Vital.IA + Fase 0 (Focus + certificado).
