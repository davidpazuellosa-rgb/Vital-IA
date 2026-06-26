# Plano — Integração NF-e direta com a SEFAZ (independência total, sem intermediário)

Documento de planejamento. **Nada aqui foi executado ainda.** Escopo: NF-e de **mercadoria (modelo 55)**, emitente **Simples Nacional** em Manaus/AM. Objetivo: emitir NF-e **sem provedor pago** (Focus/PlugNotas) e **sem site grátis de terceiros** — falando direto com os web services da SEFAZ-AM. Único custo recorrente: o **certificado A1** (já temos).

> ⚠️ Trade-off assumido conscientemente: independência total custa **alto esforço de construção + manutenção eterna** (Notas Técnicas, contingência, guarda de XML). Este plano é para quem aceita esse custo em troca de zero dependência externa.

---

## 0. Precisa de aprovação de algum órgão? (a dúvida central)

**Não precisa de aprovação/homologação do seu software** por ninguém. A SEFAZ **não certifica nem aprova emissor** — qualquer sistema que monte o XML correto, assine e transmita é aceito. O que existe é:

| Requisito | O que é | Status |
|---|---|---|
| **Credenciamento NF-e do CNPJ na SEFAZ-AM** | A *empresa* (não o software) ser autorizada a emitir NF-e no estado. Feito uma vez. | a confirmar |
| **Inscrição Estadual (IE) ativa** | Cadastro estadual do CNPJ. | a confirmar |
| **Certificado A1 e-CNPJ (ICP-Brasil)** | A única "aprovação" envolvida — emitido por uma Autoridade Certificadora. É a identidade que assina e autentica na SEFAZ. | ✅ já temos |
| **Ambiente de homologação** | Ambiente de teste da própria SEFAZ-AM (notas sem valor fiscal). Não é aprovação — é onde você valida antes de produção. | usar antes do go-live |

Ou seja: **independência é juridicamente possível**. Você não pede licença pra ninguém — só precisa do CNPJ credenciado + IE + certificado A1. Nenhum Gov, nenhuma SEFAZ, nenhum órgão aprova o código.

**O que passa a ser sua responsabilidade** (e antes era do provedor):
- **Guarda dos XML autorizados por 5 anos** (o XML é o documento fiscal; o DANFE é só a representação impressa). Isso vira obrigação sua.
- **Acompanhar as Notas Técnicas** da NF-e (mudanças de layout/regras) e atualizar o sistema.
- **Contingência** quando a SEFAZ-AM cair.

---

## Decisão de arquitetura

**Microserviço dedicado, atrás da mesma interface que o `focus.ts` já expõe.**

O módulo do Vital.IA hoje conversa com a emissão por uma interface limpa em [`src/lib/nota-fiscal/focus.ts`](../../src/lib/nota-fiscal/focus.ts): `emitirNFe`, `consultarNFe`, `cancelarNFe`, `cartaCorrecaoNFe`, `baixarArquivo`. **Vamos construir uma implementação direta-SEFAZ que respeita exatamente esse contrato.** Assim `actions.ts`, o webhook, o formulário e os tipos quase não mudam — troca-se só a "engine" por baixo.

**Linguagem: microserviço em PHP usando a `sped-nfe` (recomendado).**
- A `sped-nfe` (nfephp-org, open-source) é a biblioteca mais testada do Brasil para integração direta: já resolve assinatura XMLDSig, schema 4.00, SOAP, contingência, geração de DANFE, eventos e acompanha as Notas Técnicas. Roda **no nosso próprio servidor** — é biblioteca open-source, **não** é dependência de empresa nenhuma, então preserva a independência total.
- O microserviço expõe uma **API REST privada** (mesma forma do Focus). O Next.js chama **servidor-a-servidor**. O certificado A1 fica **só** nesse serviço.
- **Não** é WebView/iframe — é API. A emissão continua programática (roteamento, registro, anexo automáticos).

> Alternativa (TypeScript puro, stack única): viável tecnicamente (`xml-crypto` para assinatura, TLS mútuo nativo no Node), mas as bibliotecas TS de NF-e são bem menos maduras que a `sped-nfe`, e você reconstrói à mão as partes de maior risco (assinatura exata, DANFE, eventos, manutenção das NTs). **Mais risco e mais tempo.** Recomendo PHP/sped-nfe; manter como alternativa só se a operação de um runtime PHP for inaceitável. Decidir na Fase 0.

---

## Fases

### Fase 0 — Pré-requisitos e decisões (negócio + 1 decisão técnica)
- [ ] Confirmar **credenciamento NF-e do CNPJ na SEFAZ-AM** + **IE ativa** (a contabilidade resolve).
- [ ] Confirmar URLs **de produção e homologação** dos web services da SEFAZ-AM no Portal Nacional da NF-e (AM é **autorizador próprio**, não usa SVRS).
- [ ] Certificado **A1** em `.pfx` + senha, guardado como segredo do servidor (nunca no repo).
- [ ] **Decidir a linguagem do microserviço** (recomendado: PHP/sped-nfe).
- [ ] Definir onde o microserviço roda (mesmo servidor do app, container separado) e como o Next.js o alcança em rede privada.

### Fase 1 — Microserviço base + handshake com a SEFAZ
- Esqueleto do microserviço (PHP/sped-nfe) com config do certificado A1 e do CNPJ emitente.
- **TLS mútuo**: carregar o A1 no handshake HTTPS com a SEFAZ-AM.
- Implementar o **"status do serviço"** (consulta de disponibilidade da SEFAZ — o "hello world" da integração): se isso responde, o certificado, a rede e as URLs estão certos.
- Apontar tudo para **homologação** primeiro.

### Fase 2 — Montar e assinar a NF-e (modelo 55, layout 4.00)
- Gerar o XML da NF-e a partir dos dados (reaproveitar a lógica de `montarPayload*` já existente, traduzindo para o leiaute 4.00).
- **Chave de acesso** (44 dígitos + DV módulo 11).
- **Assinatura XMLDSig** no `infNFe` (enveloped, C14N, RSA-SHA256) — a sped-nfe faz; validar byte a byte.
- **Validar contra o XSD 4.00** antes de transmitir (evita rejeição 215/225).

### Fase 3 — Transmitir e tratar o retorno
- Enviar para **autorização** na SEFAZ-AM e tratar o `cStat`/`xMotivo` de retorno.
- Mapear status para o nosso enum (`autorizada`/`rejeitada`/`processando`/`cancelada`) — **mesma semântica do `focus.ts`**.
- Tratar **rejeições comuns** (checklist abaixo) com mensagens claras (reaproveita o tratamento que já existe).

### Fase 4 — DANFE + XML autorizado + guarda
- Gerar o **DANFE (PDF)** a partir do XML autorizado (sped-nfe gera).
- Expor `baixarArquivo` (DANFE/XML) igual ao contrato atual.
- **Guardar o XML autorizado** de forma durável (obrigação legal de 5 anos) — armazenamento do Supabase/Storage do Vital.IA.

### Fase 5 — Plugar no Vital.IA (trocar a engine)
- Criar `src/lib/nota-fiscal/sefaz.ts` (ou um cliente que chama o microserviço) **implementando a mesma interface** do `focus.ts`.
- Selecionar a engine por env (`NFE_ENGINE=focus|sefaz`) para poder alternar/rollback sem reescrever o app.
- Ajustar `actions.ts`/webhook só no ponto de seleção. UI e formulário inalterados.

### Fase 6 — Eventos + contingência
- **Cancelamento** (justificativa 15–255) e **Carta de Correção CC-e** (15–1000) — já existem no app, só ligar na nova engine.
- **Inutilização** de numeração (faixa de números não usada).
- **Contingência do AM = SVC-RS**: detectar SEFAZ-AM indisponível e cair para o autorizador de contingência automaticamente.

### Fase 7 — Robustez e produção
- Virar o ambiente para **produção** (URLs + certificado) com flag de homologação visível na UI (já existe `ehHomologacao()`).
- **Monitorar validade do certificado A1** (alerta antes de expirar — renova ~1×/ano) via o módulo de Alertas (Telegram).
- **Rotina de acompanhar Notas Técnicas** (processo, não código): assinar o canal da NF-e e atualizar a sped-nfe quando sair NT.
- Backup/retenção dos XML (5 anos).

---

## Parte fiscal (herdada do PLAN-nfe-am.md — sem mudança)
Como o emitente e as operações são os mesmos, a parametrização fiscal já decidida vale igual aqui:

| Operação | CFOP típico | CSOSN | Crítico |
|---|---|---|---|
| Interna AM | 5101/5102 | 102 (500 se ST) | base atual cobre |
| Interestadual | 6101/6102 | 102 | **DIFAL: Simples NÃO recolhe** — sem campos de DIFAL |
| Órgão público | 5101/6101 | 102 | `indIEDest=9` sem IE; empenho/PROAD em `infAdic` |
| ZFM/SUFRAMA | — | — | **Fora de escopo** (Vital Norte sem incentivo ZFM hoje) |

## Checklist anti-rejeição (cStat comuns) — igual ao plano de AM
- [ ] NCM válido (8 dígitos); CEST quando houver ST.
- [ ] CFOP × CSOSN compatíveis.
- [ ] IE do destinatário / `indIEDest` correto (207–229).
- [ ] `dhEmi` sem atraso (228/703); sem chave duplicada (204/539).
- [ ] Certificado válido e CNPJ credenciado (280/281).
- [ ] Schema 215/225 → XML completo conforme layout 4.00.

---

## Riscos e mitigação
- **Assinatura XMLDSig errada** (causa nº1 de fracasso na integração direta) → usar sped-nfe (testada) + validar XSD antes de enviar; testar exaustivamente em homologação.
- **Notas Técnicas quebram o layout** → manter a sped-nfe atualizada; processo de acompanhamento na Fase 7.
- **SEFAZ-AM fora do ar** → contingência SVC-RS (Fase 6).
- **Perda de XML** (são o documento fiscal por 5 anos) → guarda durável + backup (Fase 4/7).
- **Certificado expira** → alerta automático (Fase 7).
- **Operar runtime PHP junto do Next.js** → microserviço isolado em container; se for impeditivo, reavaliar a alternativa TS (com o risco maior assumido).

## Ordem de execução sugerida
Fase 1 (handshake) → 2 (assinar) → 3 (transmitir) → 4 (DANFE/guarda) entregam a emissão. Fase 5 pluga no app. Fase 6 (eventos/contingência) e 7 (produção/robustez) fecham para go-live. Tudo em **homologação** até a Fase 7.
