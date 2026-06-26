# nfe-service — emissão NF-e direta com a SEFAZ-AM

Microserviço que assina e transmite NF-e (modelo 55) direto para a SEFAZ-AM, sem provedor pago, usando a biblioteca open-source [`sped-nfe`](https://github.com/nfephp-org/sped-nfe). É consumido pelo Vital.IA via API REST privada — ver `src/lib/nota-fiscal/sefaz.ts`.

> Roda **fora da Vercel** (a Vercel é serverless e não hospeda PHP). O certificado A1 fica **só aqui**, como segredo do host.

## Estado atual (Fase 1 do PLAN-sefaz-direto.md)
- ✅ Esqueleto + roteador + autenticação Bearer.
- ✅ `GET /status-servico` — handshake com a SEFAZ-AM (prova certificado + rede + URLs).
- ⏳ Emissão/consulta/cancelamento/CC-e: stub `501` (Fases 2, 3 e 6).

> ⚠️ **Ainda não validado em execução** — foi escrito sem PHP/Docker na máquina de desenvolvimento. Validar com os passos abaixo assim que o certificado e o credenciamento (Fase 0) estiverem prontos.

## Endpoints
| Método | Rota | Função |
|---|---|---|
| GET | `/health` | Liveness (sem token, sem certificado) |
| GET | `/status-servico` | Status da SEFAZ-AM — `cStat 107` = operante |
| POST | `/nfe?ref=` | Emitir (Fase 2–3) — `501` por ora |
| GET | `/nfe/{ref}` | Consultar (Fase 3) — `501` por ora |
| DELETE | `/nfe/{ref}` | Cancelar (Fase 6) — `501` por ora |
| POST | `/nfe/{ref}/carta-correcao` | CC-e (Fase 6) — `501` por ora |

## Pré-requisitos (você fornece — Fase 0)
1. **Docker** instalado na máquina (o container traz PHP + extensões).
2. **Certificado A1** (`.pfx`) + senha.
3. **CNPJ credenciado para NF-e na SEFAZ-AM** + Inscrição Estadual ativa.
4. Confirmar as **URLs dos web services da SEFAZ-AM** (a `sped-nfe` já as traz; validar a versão).

## Rodar local (homologação)
```bash
cp .env.example .env            # preencha os valores
docker build -t nfe-service .
docker run --rm -p 8080:8080 --env-file .env nfe-service
# Em outro terminal:
curl localhost:8080/health
curl -H "Authorization: Bearer SEU_TOKEN" localhost:8080/status-servico
# Esperado: {"cStat":"107","xMotivo":"...em Operação","operante":true,...}
```

## Deploy (Railway, sugerido)
- Novo projeto a partir deste diretório (Dockerfile detectado automaticamente).
- Definir as variáveis do `.env.example` como **secrets** no Railway.
- Railway injeta `$PORT`; o container já o respeita.
- No Vital.IA (Vercel), apontar `NFE_SERVICE_URL` para a URL pública do Railway e usar o **mesmo** `NFE_SERVICE_TOKEN`.
