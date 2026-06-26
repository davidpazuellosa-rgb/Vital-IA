# Handoff — integração direta SEFAZ (sessão noturna)

Resumo do que avancei enquanto você dormia, **o que está validado e o que não está**, e as decisões que preciso de você para seguir. Plano-mãe: [`docs/planejamento/PLAN-sefaz-direto.md`](../docs/planejamento/PLAN-sefaz-direto.md).

## TL;DR
- **Costura no app (engine selecionável): pronta e VALIDADA** (`tsc` + lint). O Focus segue funcionando; a engine `sefaz` entra por env.
- **Microserviço PHP: código das Fases 1–3 e 6 ESCRITO, mas NÃO validado em execução** — o Docker não chegou a subir nesta sessão (ficou preso na tela inicial/Rosetta). Nenhuma linha de PHP rodou ainda.
- Há **lacunas de integração reais** (numeração, IBGE, persistência de chave) que precisam da sua decisão antes de emitir de verdade.

## O que está VALIDADO ✅
- `src/lib/nota-fiscal/engine.ts` seleciona `focus`|`sefaz` por `NFE_ENGINE`; `sefaz.ts` é o cliente HTTP; app importa de `engine`. Compila e passa lint. Default `focus` → comportamento atual intacto.

## O que NÃO está validado ⚠️ (escrito sem poder rodar PHP)
- `nfe-service/` inteiro: `montar()` (XML 4.00), `assinar()`, `emitir()` (lote síncrono), `consultar()`, `cancelar()`, `cartaCorrecao()`, roteador.
- Os nomes de métodos da `sped-nfe` (v5) foram escritos de memória — o **smoke test** abaixo é quem confirma. Espere ajustar 1–2 nomes/campos na primeira execução.

## PRIMEIRO PASSO de manhã: validar o núcleo offline (não precisa de certificado real)
O smoke test monta uma NF-e de exemplo, assina com um cert autoassinado e valida contra o **XSD oficial 4.00** — sem SEFAZ, sem seu certificado.

```bash
cd nfe-service
docker build -t nfe-service .          # 1ª vez baixa PHP+extensões (alguns min)
docker run --rm nfe-service php bin/smoke.php
# Esperado no fim: "✅ SMOKE OK — NF-e montada, assinada e válida contra o XSD 4.00."
```
Se acusar erro de método/campo, me chame — corrijo o `Emissor.php` contra a mensagem do XSD. **Esse é o teste que tira o risco da parte mais difícil (XML + assinatura).**

## DEPOIS: handshake real com a SEFAZ-AM (precisa do seu certificado)
```bash
cp .env.example .env     # preencha: cert A1 (base64), senha, CNPJ, IE, endereço do emitente
docker run --rm -p 8080:8080 --env-file .env nfe-service
curl localhost:8080/health
curl -H "Authorization: Bearer SEU_TOKEN" localhost:8080/status-servico
# Esperado: {"cStat":"107","operante":true,...}  → handshake fechado (Fase 1 validada de verdade)
```
Gerar o base64 do certificado: `base64 -i seu-cert.pfx | tr -d '\n'`

## Lacunas de integração — PRECISO DA SUA DECISÃO 🔑
O Focus resolvia isso por baixo; na integração direta vira nosso. Minhas recomendações:

1. **Numeração da nota (`nNF`/`série`)** — a NF-e exige numeração sequencial **sem buracos** por série. O serviço é stateless; quem deve alocar é o app.
   → **Recomendo:** tabela/contador no Supabase (`sequencia_nfe` por série), o app aloca no emitir e envia `numero`+`serie` no payload. Buraco/erro de transmissão → `inutilização` (Fase 6).

2. **Código IBGE do município do destinatário (`cMun`, 7 díg.)** — a NF-e exige o código, não o nome. Hoje o payload só tem o nome.
   → **Recomendo:** resolver no app via **BrasilAPI** (vocês já usam pra CNPJ) ou tabela IBGE, e enviar `codigo_municipio_destinatario`. (Manaus = 1302603.)

3. **Persistência de chave/protocolo** — `consultar`/`cancelar`/`cartaCorrecao` operam por **chave** (e protocolo no cancelamento), não por `ref`.
   → **Recomendo:** colunas `chave` e `protocolo` em `notas_fiscais`; `emitir()` já devolve ambas + o XML autorizado (base64) pro app guardar (guarda fiscal de 5 anos via Supabase Storage, fluxo que já existe). Aí ajusto `sefaz.ts` pra usar a chave guardada.

4. **Endereço/IE do emitente** — não vêm no payload; pus como **env do serviço** (`NFE_EMIT_*`). Só preencher o `.env`.

5. **DANFE (PDF)** — Fase 4, ainda não gerada. A `sped-nfe` gera (`Danfe`); implemento depois do núcleo validar.

6. **Contingência SVC-RS / sync vs async** — emiti em **lote síncrono** (`indSinc=1`); confirmar que a SEFAZ-AM aceita bem. Contingência (Fase 6) ainda não feita.

## Commits desta sessão (branch `feat/nota-fiscal`, sem push)
- `76efe67` — Fase 1: costura de engine + esqueleto do serviço.
- + commit desta noite — Fases 2/3/6 (montar/assinar/transmitir/eventos) + smoke test. **Não validado em execução.**

## Sugestão de ordem ao acordar
1. Rodar o **smoke** (valida o núcleo, não precisa de cert). Corrigir o que o XSD apontar.
2. Preencher `.env` e rodar **`/status-servico`** em homologação (valida o handshake real).
3. Decidir comigo as **lacunas 1–3** (numeração, IBGE, chave/protocolo) → eu implemento a ponte no app + emito uma nota de teste em homologação.
4. DANFE (Fase 4) + contingência (Fase 6) + deploy no Railway (Fase 7).
