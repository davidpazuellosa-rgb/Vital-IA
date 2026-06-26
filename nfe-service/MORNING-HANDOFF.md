# Handoff — integração direta SEFAZ

Estado atual e o **mínimo** que falta. Plano-mãe: [`docs/planejamento/PLAN-sefaz-direto.md`](../docs/planejamento/PLAN-sefaz-direto.md).

## TL;DR
Praticamente tudo está feito e validado offline. **Só faltam 3 ações suas** (no fim). O Docker **não sobe nesta máquina** (bug de VM) — contornado com PHP nativo; o Docker fica só para o deploy no Railway (builda na nuvem).

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

## ⚠️ NÃO validado (depende do seu certificado)
Transmitir de fato (emitir/consultar/cancelar/CC-e). O código está escrito e os métodos batem com a API real da `sped-nfe` v5.2.6 — só um envio em homologação confirma.

---

## O que falta — SÓ 3 coisas suas

### 1. Senha do certificado → ver o handshake (2 min)
Abra `nfe-service/.env`, preencha `NFE_CERT_PASSWORD=` com a senha do seu `.pfx`, e rode:
```bash
cd ~/Desktop/Projetos/Vital.IA/nfe-service && ~/bin/php bin/status.php
```
**✅ Esperado:** `cStat: 107 — ... em Operação ✅ handshake OK`.
> Ou: me passe a senha aqui no chat que eu preencho e rodo pra você.

### 2. Aplicar a migration no Supabase (1 min)
Painel do Supabase → **SQL Editor** → cole o conteúdo de
`supabase/migrations/20260626140000_notas_fiscais_sefaz_direto.sql` e rode.
(Não consigo fazer isso por aqui — DDL precisa de acesso de admin ao banco que não tenho.)

### 3. (Depois que 1 e 2 passarem) Emitir 1 nota teste em homologação
Me chama: a gente liga `NFE_ENGINE=sefaz` no `.env.local`, emite uma nota de teste (sem valor fiscal) e confere `cStat 100` (autorizada) + DANFE/XML guardados.

---

## Depois (produção) — Fase 7
Deploy do `nfe-service` no **Railway** (usa o `Dockerfile`; ~US$5/mês; precisa da sua conta) e apontar a Vercel: `NFE_ENGINE=sefaz`, `NFE_SERVICE_URL`, `NFE_SERVICE_TOKEN` (o mesmo do `.env`), `NFE_SEFAZ_AMBIENTE=producao`. Falta também a **contingência SVC-RS** (Fase 6).

## Commits (branch `feat/nota-fiscal`, sem push)
`d130b54` plano · `76efe67` Fase 1 · `55af307` Fases 2/3/6 · `2a75223` Fase 2 validada · `03e17e4` docs · `c6da4e6`+`1323b5c` ponte no app · `06c32e3` Fase 4 (DANFE+guarda).
