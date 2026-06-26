<?php

declare(strict_types=1);

namespace Vitalia\NfeService;

use NFePHP\Common\Certificate;
use NFePHP\Common\Standardize;
use NFePHP\NFe\Tools;

/**
 * Fábrica de configuração da sped-nfe a partir de variáveis de ambiente.
 *
 * Segredos (definidos no host, nunca no repo):
 *   NFE_SERVICE_TOKEN     token Bearer que o Vital.IA usa para chamar este serviço
 *   NFE_CERT_PFX_BASE64   certificado A1 (.pfx) inteiro, codificado em base64
 *   NFE_CERT_PASSWORD     senha do .pfx
 *   NFE_CNPJ              CNPJ do emitente (só dígitos)
 *   NFE_RAZAO_SOCIAL      razão social do emitente
 *   NFE_UF                UF do emitente (ex.: AM)
 *   NFE_AMBIENTE          "homologacao" (padrão) | "producao"
 */
final class Sefaz
{
    public static function env(string $chave, string $padrao = ''): string
    {
        $valor = getenv($chave);
        return $valor === false ? $padrao : $valor;
    }

    public static function ehHomologacao(): bool
    {
        return strtolower(self::env('NFE_AMBIENTE', 'homologacao')) !== 'producao';
    }

    /** tpAmb da SEFAZ: 1 = produção, 2 = homologação. */
    public static function tpAmb(): int
    {
        return self::ehHomologacao() ? 2 : 1;
    }

    /** Monta o objeto Tools da sped-nfe já com certificado e config do emitente. */
    public static function tools(): Tools
    {
        $pfxBase64 = self::env('NFE_CERT_PFX_BASE64');
        $senha = self::env('NFE_CERT_PASSWORD');
        if ($pfxBase64 === '' || $senha === '') {
            throw new \RuntimeException('Certificado A1 não configurado (NFE_CERT_PFX_BASE64 / NFE_CERT_PASSWORD).');
        }

        $pfx = base64_decode($pfxBase64, true);
        if ($pfx === false) {
            throw new \RuntimeException('NFE_CERT_PFX_BASE64 não é base64 válido.');
        }

        $config = json_encode([
            'atualizacao' => date('Y-m-d H:i:s'),
            'tpAmb' => self::tpAmb(),
            'razaosocial' => self::env('NFE_RAZAO_SOCIAL'),
            'cnpj' => self::env('NFE_CNPJ'),
            'siglaUF' => self::env('NFE_UF', 'AM'),
            'schemes' => 'PL_009_V4',
            'versao' => '4.00',
        ], JSON_THROW_ON_ERROR);

        $certificado = Certificate::readPfx($pfx, $senha);
        $tools = new Tools($config, $certificado);
        $tools->model('55'); // NF-e de mercadoria
        return $tools;
    }

    /** Converte a resposta SOAP da SEFAZ num objeto padronizado (cStat, xMotivo, ...). */
    public static function padronizar(string $respostaXml): \stdClass
    {
        return (new Standardize($respostaXml))->toStd();
    }
}
