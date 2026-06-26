# Plano — Controle de Emissão NF-e por emissores grátis (roteamento de cota)

Documento de planejamento. **Nada aqui foi executado ainda.**

## Contexto e decisão
Não existe API de NF-e de produção gratuita confiável (Nuvem Fiscal será desativado em 31/07/2026; demais provedores cobram após trial). Decisão: usar **emissores web gratuitos** e automatizar tudo **em volta** da emissão.

- **Emissão = manual** (NFe+ e NF Grátis são interfaces web, sem API). O usuário clica "emitir" no site.
- **Gestão dos 65/mês = automática** no Vital.IA: roteamento (qual emissor usar), contagem de cota, registro da nota e anexo ao cliente/contratação.
- Emissores e cotas (config inicial): **NFe+ = 15/mês**, **NF Grátis = 50/mês** → **65/mês**. Cotas editáveis (podem mudar).
- Regra de roteamento: preenche o **NFe+** até 15, depois o **NF Grátis** até 50; ao esgotar os 65, avisa.
- Custo: só o **certificado A1** (já tem; renova ~1×/ano). Nenhuma mensalidade.

> ⚠️ Validar na Fase 0: NFe+ e NF Grátis emitem **NF-e modelo 55** (mercadoria) e atendem **AM**; confirmar as cotas atuais.

## Como convive com o módulo NF-e existente
Já existe `notas_fiscais` (fluxo API/Focus, hoje sem token). Este fluxo é **manual**: reaproveita a mesma tabela com um campo `origem = 'manual'` e `emissor`, e ignora os campos de API (ref/payload/status de processamento). Assim não fragmenta o módulo e o anexo (DANFE/XML → cliente/contratação) já existe.

---

## Fase 0 — Pré-requisitos (negócio)
- Confirmar que **NFe+** e **NF Grátis** fazem **NF-e 55** e atendem **AM**; anotar as **cotas reais** e os **links de emissão**.
- Cadastrar a empresa (CNPJ Vital) + subir o **certificado A1** em cada site (uma vez por emissor).
- (Sem custo de software.)

## Fase 1 — Modelo de dados
- Tabela `emissores_nfe` (config editável): `slug`, `nome`, `url`, `cota_mensal`, `ordem`, `ativo`. Seed: `nfemais` (15, ordem 1), `nfgratis` (50, ordem 2).
- Em `notas_fiscais`: adicionar `origem text default 'api'` e `emissor text default ''`. (Migration aditiva e idempotente.)
- Cota do mês = `count(notas_fiscais where origem='manual' and emissor=X and to_char(created_at,'YYYY-MM')=mês_atual)`.

## Fase 2 — Roteamento + painel de cota
- Função `proximoEmissor()`: percorre emissores por `ordem`, retorna o primeiro com cota restante > 0; se todos esgotados, retorna "limite atingido".
- UI (página/seção "Emissão grátis"): cartões por emissor com **X/cota** usados e restante; destaque **"Use agora: NFe+ (faltam 8 de 15)"** com **botão/link** que abre o site do emissor indicado.
- Barra de total do mês: **usadas/65** e restante.

## Fase 3 — Registrar nota emitida (+ anexo)
- Botão **"Registrar nota emitida"** → formulário: cliente + contratação (reaproveita os seletores), número da NF, valor, data de emissão, e upload de **DANFE (PDF)** e **XML**.
- Ao salvar: grava em `notas_fiscais` (`origem='manual'`, `emissor=<indicado ou escolhido>`), **abate a cota**, e **anexa o DANFE/XML ao cliente/contratação** (fluxo de documentos que já existe).
- Validação: bloquear registro no emissor cuja cota está esgotada (sugerir o próximo).

## Fase 4 — Painel mensal + reset
- Visão do mês corrente: notas por emissor, total, restante; lista das notas registradas (com link p/ DANFE/XML).
- **Reset automático**: a cota é calculada por mês corrente (não precisa job); virou o mês, zera sozinha.
- Histórico: meses anteriores (quantas por emissor).

## Fase 5 — Alertas e ajustes
- Avisos (toast/Telegram via Alertas): "NFe+ chegando ao limite (13/15)", "restam 5 de 65 neste mês".
- Editar cotas/ordem dos emissores (caso mudem) e ativar/desativar emissor.
- (Opcional) adicionar um 3º emissor grátis no futuro só cadastrando na tabela.

---

## Ordem de execução sugerida
Fase 1 → 2 → 3 entregam o núcleo funcional (cota + roteamento + registro/anexo). Fase 4 e 5 são refino. Fase 0 (validação dos emissores) deve sair **antes** de depender deles em produção.
