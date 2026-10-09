# Envio de propostas nas plataformas — plano em 3 frentes

Objetivo: reduzir o trabalho e o risco de **enviar propostas** nos sistemas de licitação
(Licitar Digital, BLL, Licitanet, Compras.gov.br, e-Compras AM, Compras Manaus, Petronect…)
**sem automatizar o envio em si** — a proposta é compromisso legal com preço, então a decisão de
enviar e o login (certificado digital / gov.br com 2º fator) continuam humanos.

Por que não um robô que envia sozinho: não há API pública de envio nessas plataformas; o login
exige certificado/2º fator/captcha; várias plataformas proíbem robôs; um erro vira multa ou
desclassificação; e guardar as credenciais da empresa num sistema é um risco desnecessário.

O que já existe e é reaproveitado: proposta com itens/preços (`propostas.itens`), análise do edital
por IA, PDF da proposta e das declarações, assinatura gov.br, importação da proposta final no
cliente, etapas da licitação (`oportunidade → proposta_pronta → proposta_enviada → vencida/perdida`),
atalhos dos portais (página *Sistemas de Licitação*), exportação ZIP de documentos, alertas
(Telegram/e-mail) e o cron na VPS.

---

## Frente 3 — Controle do que foi enviado  *(base das outras; começa primeiro)*

1. **Dados do envio** em `propostas`: plataforma, data/hora, protocolo, valor enviado, observações,
   comprovante (arquivo no bucket `documentos`). Status `enviada`.
2. **Registrar envio**: formulário (data/hora, protocolo, valor, comprovante). Ao salvar, a licitação
   vai para a etapa **Proposta enviada** automaticamente; dá para **desfazer**.
3. **Prazos na tela**: contagem regressiva do encerramento das propostas, com aviso em vermelho
   quando falta pouco ou já passou, em *Minhas Licitações* e no diálogo de envio.
4. **Lembretes**: rotina horária na VPS (junto do cron de alertas) avisa por Telegram/e-mail
   "proposta X encerra em 24h / 2h e ainda não foi enviada".
5. **Painel "Em andamento"** em *Minhas Licitações*: propostas prontas e não enviadas, ordenadas por prazo.
6. **Resultado**: registrar vencida/perdida com valor homologado (reaproveita as etapas existentes),
   para medir taxa de vitória por plataforma.

## Frente 1 — Pacote de envio por plataforma

1. **Detectar a plataforma** da licitação pelo endereço de origem (mesma lista da busca) e casar com
   o atalho cadastrado em *Sistemas de Licitação* (usa o login salvo e a aba reutilizada).
2. **Diálogo "Enviar proposta"** com checklist: itens com preço, pendências de habilitação (da última
   análise do edital), prazo, e itens que só a pessoa confere (proposta assinada, declarações).
3. **Tabela de itens para copiar**: item, descrição, marca, quantidade, unidade, valor unitário e total,
   com clique para copiar cada campo e "copiar tudo" (colável em planilha/formulário).
4. **Documentos de habilitação em um ZIP** só com o que o edital pede (os que a análise marcou como
   disponíveis), mais o PDF da proposta e das declarações.
5. **Botão "Abrir {plataforma}"** na aba da plataforma (login mantido).
6. **Roteiro por plataforma** (arquivo de dados, não código): a ordem das telas e os nomes dos campos de
   cada sistema, para o pacote seguir a ordem em que a pessoa preenche. Começa genérico e é refinado
   com as telas reais.

## Frente 2 — Assistente de preenchimento (extensão do Chrome)

Preenche o formulário da plataforma **na sessão já logada da pessoa**, e **para antes de enviar**.

1. **Escolher a plataforma piloto** (a mais usada) e **mapear o formulário real de proposta** com a
   equipe acompanhando (só leitura: estrutura dos campos, sem enviar nada).
2. **Endpoint do pacote** `/api/propostas/{id}/pacote`: devolve os itens/valores/anexos; autenticado por
   um **código de uso único e curto**, gerado na tela do Vital.IA (a extensão nunca guarda senha).
3. **Extensão (Manifest V3)**: ativa só nos endereços das plataformas; um *perfil por plataforma* diz
   onde cada dado vai. Botão **"Preencher com Vital.IA"**, destaque dos campos preenchidos e dos que
   divergem, **sem clicar em enviar**.
4. **Teste em ambiente de treinamento/homologação** da plataforma (várias oferecem) antes de usar em
   licitação real; primeira proposta real com acompanhamento.
5. **Instalação**: arquivo `.zip` carregado no Chrome da equipe (2 pessoas) — sem loja.
6. **Manutenção**: se a plataforma mudar a tela, ajusta-se o perfil daquele sistema.
7. Uma plataforma por vez; só se segue para a próxima quando a anterior estiver estável.

---

## Ordem de entrega

| Fase | Entrega | Depende de |
|---|---|---|
| 1 | Dados de envio + registrar/desfazer + etapa automática | — |
| 2 | Diálogo "Enviar proposta": checklist, tabela p/ copiar, abrir plataforma | Fase 1 |
| 3 | ZIP de habilitação + PDFs no pacote | Fase 2 |
| 4 | Prazos + lembretes + painel "Em andamento" | Fase 1 |
| 5 | Roteiro por plataforma | telas reais |
| 6 | Extensão (piloto) | Fase 5 e escolha da plataforma |

Segurança: sem senha guardada; extensão com código de uso único e limitada aos endereços das
plataformas; envio sempre por clique humano; comprovantes no bucket privado da empresa.
