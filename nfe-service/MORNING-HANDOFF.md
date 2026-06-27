# Handoff — integração direta SEFAZ

Estado atual e o **mínimo** que falta. Plano-mãe: [`docs/planejamento/PLAN-sefaz-direto.md`](../docs/planejamento/PLAN-sefaz-direto.md).

## TL;DR
🎉 **Emissão AUTORIZADA na SEFAZ-AM (homologação): cStat 100.** A integração direta funciona **de ponta a ponta** com o certificado real — montar, assinar, transmitir, protocolo, XML autorizado e DANFE (PDF). Nota teste: chave `13260649594277000189550010009496921091317196`, protocolo `113260013349615`.

Falta só: **aplicar a migration no Supabase**, **emitir uma vez pela tela do app** (não só pelo script), e o **deploy no Railway** (produção). O Docker não sobe nesta máquina (usei PHP nativo); o Docker fica só pro Railway.

## ✅ Feito e VALIDADO (rodou de verdade, com PHP nativo)
1. **Costura no app** (`engine.ts`/`sefaz.ts`) — `NFE_ENGINE` alterna Focus⇄SEFAZ. Default Focus intacto. tsc+lint OK.
2. **Fase 2 — montar + assinar** — `bin/smoke.php` monta, assina e **valida no XSD 4.00** (chave AM ok).
3. **Roteador + auth** — `/health`, 401, 404, 400. OK.
4. **Fase 4 — DANFE** — `sped-da` renderiza o PDF (validado no smoke, 15 KB). O app guarda XML+DANFE no Storage e reaproveita no anexar.
5. **Ponte no app** (gated em `NFE_ENGINE=sefaz`): numeração `nNF` atômica (migration), IBGE `cMun` resolvido na emissão via BrasilAPI, chave/protocolo gravados. tsc+lint OK.

## ✅ Já preparei PARA VOCÊ
- **`~/bin/php` + `~/bin/composer.phar`** instalados (PHP 8.3.31 nativo). Dependências (`sped-nfe`, `sped-da`) já instaladas em `nfe-service/vendor`.
- **`nfe-service/.env` preenchido** com seus dados reais (CNPJ, IE, endereço puxados do Supabase; certificado embutido em base64; token gerado). **Só falta `NFE_CERT_PASSWORD`.**
- **`bin/status.php`** — checa a SEFAZ-AM com um comando.

## ✅ VALIDADO com a SEFAZ real (homologação)
- **Handshake** — `bin/status.php` → cStat 107 (serviço em operação).
- **Emissão** — `bin/emitir-teste.php` → **cStat 100 (autorizada)**, protocolo recebido, XML autorizado (nfeProc) + DANFE (PDF 15 KB) gerados. Transmissão inteira provada.

---

## O que falta

### 1. Aplicar a migration no Supabase (1 min) — você
Painel do Supabase → **SQL Editor** → cole o conteúdo de
`supabase/migrations/20260626140000_notas_fiscais_sefaz_direto.sql` e rode.
(Não consigo por aqui — DDL precisa de acesso de admin ao banco que não tenho.)

### 2. Emitir uma vez pela TELA do app — comigo
O CLI já provou a SEFAZ. Falta exercitar o fluxo dentro do Vital.IA: ligar `NFE_ENGINE=sefaz` (+ `NFE_SERVICE_URL`/`NFE_SERVICE_TOKEN`) no `.env.local`, subir o serviço local e emitir uma nota pela interface. Me chama que a gente faz.

### 3. Produção (Fase 7) — você + eu
Deploy do `nfe-service` no **Railway** (Dockerfile, ~US$5/mês, sua conta); apontar a Vercel; trocar p/ `NFE_AMBIENTE=producao` e `NFE_SEFAZ_AMBIENTE=producao`. Falta também contingência SVC-RS (Fase 6).

---

## Depois (produção) — Fase 7
Deploy do `nfe-service` no **Railway** (usa o `Dockerfile`; ~US$5/mês; precisa da sua conta) e apontar a Vercel: `NFE_ENGINE=sefaz`, `NFE_SERVICE_URL`, `NFE_SERVICE_TOKEN` (o mesmo do `.env`), `NFE_SEFAZ_AMBIENTE=producao`. Falta também a **contingência SVC-RS** (Fase 6).

## Commits (branch `feat/nota-fiscal`, sem push)
`d130b54` plano · `76efe67` Fase 1 · `55af307` Fases 2/3/6 · `2a75223` Fase 2 validada · `03e17e4` docs · `c6da4e6`+`1323b5c` ponte no app · `06c32e3` Fase 4 (DANFE+guarda).
