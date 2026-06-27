# nfe-service — emissão NF-e direta com a SEFAZ-AM

Microserviço que assina e transmite NF-e (modelo 55) direto para a SEFAZ-AM, sem provedor pago, usando a biblioteca open-source [`sped-nfe`](https://github.com/nfephp-org/sped-nfe). É consumido pelo Vital.IA via API REST privada — ver `src/lib/nota-fiscal/sefaz.ts`.

> Roda **fora da Vercel** (a Vercel é serverless e não hospeda PHP). O certificado A1 fica **só aqui**, como segredo do host.

## Estado atual
- ✅ Roteador + autenticação Bearer **validados** (`/health`, 401, 404, validações).
- ✅ **Fase 2 (montar + assinar) validada** — `bin/smoke.php` monta, assina e o XML passa no XSD 4.00.
- ✅ Emissão/consulta/cancelamento/CC-e implementados (`Transmissor.php`), métodos conferidos contra a `sped-nfe` v5.2.6.
- ⏳ Falta validar a **transmissão real** à SEFAZ (precisa do certificado A1 + credenciamento) e a **DANFE** (Fase 4).

> Validado com **PHP nativo (binário estático)** — o Docker não é necessário para desenvolver (e não sobe nesta máquina). O `Dockerfile` serve para o deploy no Railway. Ver `MORNING-HANDOFF.md`.

## Endpoints
| Método | Rota | Função |
|---|---|---|
| GET | `/health` | Liveness (sem token, sem certificado) |
| GET | `/status-servico` | Status da SEFAZ-AM — `cStat 107` = operante |
| POST | `/nfe?ref=` | Emitir (Fase 2–3) — `501` por ora |
| GET | `/nfe/{ref}` | Consultar (Fase 3) — `501` por ora |
| DELETE | `/nfe/{ref}` | Cancelar (Fase 6) — `501` por ora |
| POST | `/nfe/{ref}/carta-correcao` | CC-e (Fase 6) — `501` por ora |

## Pré-requisitos
- Para **desenvolver/validar local**: PHP 8.1+ com extensões dom, openssl, mbstring, soap, gd (um binário estático já resolve — ver `MORNING-HANDOFF.md`).
- Para **transmitir de verdade**: **Certificado A1** (`.pfx`) + senha, **CNPJ credenciado na SEFAZ-AM** + IE ativa.

## Rodar local (sem Docker)
```bash
php composer.phar install          # uma vez (instala sped-nfe)
php bin/smoke.php                   # valida montar+assinar+XSD (NÃO precisa de certificado)
# com certificado, para o handshake real:
cp .env.example .env               # preencha cert (base64), senha, CNPJ, IE, endereço
php -S 127.0.0.1:8080 public/index.php
curl localhost:8080/health
curl -H "Authorization: Bearer SEU_TOKEN" localhost:8080/status-servico
# Esperado: {"cStat":"107","operante":true,...}
```

## Deploy (Railway, sugerido)
- Novo projeto a partir deste diretório (Dockerfile detectado automaticamente).
- Definir as variáveis do `.env.example` como **secrets** no Railway.
- Railway injeta `$PORT`; o container já o respeita.
- No Vital.IA (Vercel), apontar `NFE_SERVICE_URL` para a URL pública do Railway e usar o **mesmo** `NFE_SERVICE_TOKEN`.
