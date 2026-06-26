# Planejamento

Documentos de planejamento do Vital.IA. Cada arquivo descreve **o que se pretende fazer** — não necessariamente o que já está implementado. Cada plano indica no topo seu estado de execução.

## Índice

| Documento | Tema | Estado |
|-----------|------|--------|
| [PLAN-nfe-am.md](PLAN-nfe-am.md) | Integração NF-e modelo 55 (mercadoria) via provedor (Focus NFe), SEFAZ-AM, zero rejeição — Simples Nacional, Manaus/AM, com ZFM/SUFRAMA e órgãos públicos. | Planejamento (não executado) |
| [PLAN-emissao-gratis.md](PLAN-emissao-gratis.md) | Controle de emissão NF-e por emissores web gratuitos (NFe+ 15/mês + NF Grátis 50/mês = 65/mês): roteamento de cota, registro e anexo. | Planejamento (não executado) |
| [PLAN-sefaz-direto.md](PLAN-sefaz-direto.md) | Integração NF-e **direta com a SEFAZ-AM**, sem provedor pago nem site grátis (independência total): microserviço PHP/sped-nfe com API REST, atrás da mesma interface do `focus.ts`. | Planejamento (não executado) |

## Convenções

- Nome dos arquivos: `PLAN-<assunto>.md`.
- Todo plano começa indicando o estado de execução e o escopo.
- Planos são organizados em **fases** (Fase 0 = pré-requisitos de negócio).
