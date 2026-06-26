# Handoff — integração direta SEFAZ (sessão noturna)

O que avancei enquanto você dormia, **o que está validado** e as decisões que preciso de você. Plano-mãe: [`docs/planejamento/PLAN-sefaz-direto.md`](../docs/planejamento/PLAN-sefaz-direto.md).

## TL;DR
- ✅ **A parte mais difícil está VALIDADA**: o microserviço **monta + assina** a NF-e e o XML **passa no XSD oficial 4.00**. Roteador + autenticação também validados. Tudo rodando de verdade.
- ⚠️ **O Docker NÃO sobe nesta máquina** (a VM Linux dele não inicializa — bug de ambiente, não do nosso código). **Contornei usando um PHP nativo (binário estático)** — não precisamos de Docker para desenvolver. O `Dockerfile` fica só para o deploy no Railway (que builda na nuvem dele, sem depender da sua máquina).
- ⏳ Falta o que depende do **seu certificado real** (transmitir à SEFAZ) e de **3 decisões de arquitetura** (numeração, IBGE, persistência) — listadas no fim.

## O que está VALIDADO ✅ (rodou de verdade)
1. **Costura no app** (`engine.ts`/`sefaz.ts`): `tsc` + lint limpos. Default `focus` intacto.
2. **Fase 2 — montar + assinar** (`bin/smoke.php`): monta uma NF-e de exemplo, assina (cert autoassinado) e **valida contra o XSD 4.00** → `✅ SMOKE OK`. Gera chave de 44 díg. correta (cUF 13 = AM).
3. **Fase 1/3 — roteador + auth** (`public/index.php`): `/health`→200, sem token→401, sem cert→500 com mensagem clara, rota inválida→404, `POST /nfe` sem número→400. Tudo conforme esperado.
4. **Nomes de método da `sped-nfe` v5.2.6** conferidos contra a API real (a v5.2.6 mudou bastante: `montaNFe()`, `model(int)`, `Complements::toAuthorize`, traits no lugar dos `tag*`). Já corrigidos.

## O que NÃO está validado ⚠️ (precisa do certificado real + credenciamento)
- **Transmissão de fato à SEFAZ-AM**: `/status-servico`, emitir, consultar, cancelar, CC-e. O código está escrito e os métodos batem com a API, mas só um envio real em homologação confirma. (Sem o cert eu não consigo ir além disso.)

## Como rodar local — SEM Docker (foi assim que validei)
O Docker não é necessário. Usei um **PHP estático** (autocontido, sem instalar nada no sistema):
```bash
# 1) baixar PHP estático (arm64) — fica numa pasta qualquer
curl -fsSL https://dl.static-php.dev/static-php-cli/common/php-8.3.31-cli-macos-aarch64.tar.gz | tar xz
chmod +x php
# 2) Composer + dependências (uma vez)
curl -fsSL https://getcomposer.org/composer-stable.phar -o composer.phar
cd nfe-service && ../php ../composer.phar install
# 3) smoke test (valida montar+assinar+XSD, NÃO precisa de certificado)
../php bin/smoke.php          # espera: ✅ SMOKE OK
```
> Alternativa permanente (recomendada quando puder, no SEU terminal, pede senha 1×):
> instalar Homebrew e `brew install php composer` — aí é só `php bin/smoke.php`.

## Handshake real com a SEFAZ-AM (precisa do seu certificado A1)
```bash
cp .env.example .env     # preencha: cert (base64), senha, CNPJ, IE, endereço do emitente
base64 -i seu-cert.pfx | tr -d '\n'     # gera o valor de NFE_CERT_PFX_BASE64
../php -S 127.0.0.1:8080 public/index.php   # ou docker/Railway em produção
curl -H "Authorization: Bearer SEU_TOKEN" localhost:8080/status-servico
# Esperado: {"cStat":"107","operante":true} → handshake fechado (Fase 1 validada de verdade)
```

## Ponte no app — IMPLEMENTADA nesta sessão (gated em `NFE_ENGINE=sefaz`, `tsc`+lint OK)
Apliquei minhas recomendações das 3 lacunas (tudo isolado: o caminho Focus, default, não mudou). **Aplicar a migration `supabase/migrations/20260626140000_notas_fiscais_sefaz_direto.sql`** no Supabase.
1. ✅ **Numeração `nNF`** — tabela `nfe_numeracao` + função `proximo_numero_nfe(serie)` (atômica). `emitirNotaFiscal` aloca o número **após** o compare-and-swap (não gera buraco em clique duplo), só quando engine=sefaz.
2. ✅ **IBGE `cMun`** — resolvido **na emissão**: `emitirNotaFiscal` (engine SEFAZ) usa o código salvo ou busca pelo **CNPJ do destinatário na BrasilAPI** (`codigo_municipio_ibge`), antes do compare-and-swap. Self-contained, funciona p/ clientes já cadastrados, sem mexer no módulo `clientes`. Bloqueia com mensagem clara só se não conseguir resolver (ex.: destinatário CPF sem município).
3. ✅ **Chave/protocolo** — colunas em `notas_fiscais`; `emitir()` devolve e o app grava. (Guarda do XML autorizado no Storage + DANFE = Fase 4, ainda pendente — o fluxo de anexar precisa de ajuste p/ engine stateless.)

## Pendências de implementação (depois das decisões acima)
- Ponte no app: enriquecer o payload (itens 1–3) e ajustar `sefaz.ts` p/ operar por chave.
- **DANFE (PDF)** — Fase 4 (pacote `sped-da`); precisa de um XML autorizado p/ testar.
- **Contingência SVC-RS** — Fase 6.
- **Deploy no Railway** — Fase 7 (usa o `Dockerfile`; a nuvem do Railway builda sem depender da sua máquina).

## Sugestão de ordem ao acordar
1. Rodar o **smoke** (confirma o núcleo; não precisa de cert).
2. Preencher `.env` com o cert real e rodar **`/status-servico`** (espera `cStat 107`).
3. Decidir comigo as **3 lacunas** → eu faço a ponte no app e emitimos uma nota de teste em homologação.

## Commits desta sessão (branch `feat/nota-fiscal`, sem push)
- `d130b54` plano · `76efe67` Fase 1 (costura+esqueleto) · `55af307` Fases 2/3/6 (código) · `2a75223` **Fase 2 validada (XSD)**.
