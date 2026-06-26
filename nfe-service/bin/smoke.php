<?php

declare(strict_types=1);

// Smoke test OFFLINE da Fase 2: monta uma NF-e de exemplo, assina com um
// certificado AUTOASSINADO gerado na hora e valida contra o XSD oficial 4.00.
// Não fala com a SEFAZ e não usa o certificado real — só prova que o XML que o
// Emissor::montar() produz é estruturalmente válido e assinável.
//
// Uso (dentro do container):  php bin/smoke.php

require __DIR__ . '/../vendor/autoload.php';

use NFePHP\Common\Certificate;
use NFePHP\Common\Validator;
use NFePHP\NFe\Tools;
use Vitalia\NfeService\Emissor;

function falhar(string $msg): never
{
    fwrite(STDERR, "❌ $msg\n");
    exit(1);
}

// ── 1. Certificado autoassinado em memória (só para exercitar a assinatura) ──
echo "→ Gerando certificado de teste (autoassinado)...\n";
$pkey = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$csr = openssl_csr_new(['commonName' => 'TESTE VITAL IA:00000000000191', 'countryName' => 'BR'], $pkey);
$x509 = openssl_csr_sign($csr, null, $pkey, 365, ['digest_alg' => 'sha256']);
$pfx = '';
openssl_pkcs12_export($x509, $pfx, $pkey, '1234');

// ── 2. Ambiente do emitente (valores de teste) ──
$env = [
    'NFE_AMBIENTE' => 'homologacao',
    'NFE_UF' => 'AM',
    'NFE_CNPJ' => '00000000000191',
    'NFE_RAZAO_SOCIAL' => 'VITAL NORTE COMERCIO LTDA',
    'NFE_EMIT_IE' => '123456789',
    'NFE_EMIT_CRT' => '1',
    'NFE_EMIT_LOGRADOURO' => 'AV EDUARDO RIBEIRO',
    'NFE_EMIT_NUMERO' => '100',
    'NFE_EMIT_BAIRRO' => 'CENTRO',
    'NFE_EMIT_CMUN' => '1302603', // Manaus
    'NFE_EMIT_XMUN' => 'Manaus',
    'NFE_EMIT_CEP' => '69010000',
];
foreach ($env as $k => $v) {
    putenv("$k=$v");
}

// ── 3. Payload de exemplo (mesmo formato do montarPayloadFocus do app) ──
$payload = [
    'natureza_operacao' => 'Venda de mercadoria',
    'tipo_documento' => 1,
    'finalidade_emissao' => 1,
    'consumidor_final' => 1,
    'presenca_comprador' => 9,
    'cnpj_emitente' => '00000000000191',
    'nome_destinatario' => 'PREFEITURA MUNICIPAL DE MANAUS',
    'cnpj_destinatario' => '04365326000173',
    'indicador_inscricao_estadual_destinatario' => 9,
    'logradouro_destinatario' => 'AV BRASIL',
    'numero_destinatario' => '2971',
    'bairro_destinatario' => 'COMPENSA',
    'municipio_destinatario' => 'Manaus',
    'codigo_municipio_destinatario' => '1302603',
    'uf_destinatario' => 'AM',
    'cep_destinatario' => '69036110',
    'informacoes_adicionais_contribuinte' => 'Ref.: PROAD 2026/0001 — Contratacao teste',
    'items' => [[
        'numero_item' => 1,
        'codigo_produto' => 'ITEM-1',
        'descricao' => 'Cadeira de rodas hospitalar',
        'codigo_ncm' => '87131000',
        'cfop' => '5101',
        'unidade_comercial' => 'UN',
        'quantidade_comercial' => 2,
        'valor_unitario_comercial' => 750.00,
        'valor_bruto' => 1500.00,
        'unidade_tributavel' => 'UN',
        'quantidade_tributavel' => 2,
        'valor_unitario_tributavel' => 750.00,
        'icms_origem' => 0,
        'icms_situacao_tributaria' => '102',
        'pis_situacao_tributaria' => '07',
        'cofins_situacao_tributaria' => '07',
    ]],
];

// ── 4. Montar ──
echo "→ Montando NF-e (Emissor::montar)...\n";
try {
    $xml = Emissor::montar($payload, nNF: 1, serie: 1);
} catch (\Throwable $e) {
    falhar('montar() lançou: ' . $e->getMessage());
}
$chave = Emissor::chaveDe($xml);
echo "  chave: " . ($chave ?: '(não encontrada)') . "\n";

// ── 5. Assinar ──
echo "→ Assinando (Tools::signNFe)...\n";
try {
    $config = json_encode([
        'atualizacao' => date('Y-m-d H:i:s'),
        'tpAmb' => 2,
        'razaosocial' => $env['NFE_RAZAO_SOCIAL'],
        'cnpj' => $env['NFE_CNPJ'],
        'siglaUF' => 'AM',
        'schemes' => 'PL_009_V4',
        'versao' => '4.00',
    ], JSON_THROW_ON_ERROR);
    $tools = new Tools($config, Certificate::readPfx($pfx, '1234'));
    $tools->model('55');
    $xmlAssinado = $tools->signNFe($xml);
} catch (\Throwable $e) {
    falhar('signNFe() lançou: ' . $e->getMessage());
}

// ── 6. Validar contra o XSD 4.00 ──
echo "→ Validando contra o XSD oficial (PL_009_V4)...\n";
$xsd = glob(__DIR__ . '/../vendor/nfephp-org/sped-nfe/schemes/PL_009_V4/nfe_v4.00.xsd')[0] ?? '';
if ($xsd === '') {
    falhar('XSD nfe_v4.00.xsd não encontrado no vendor da sped-nfe.');
}
try {
    Validator::isValid($xmlAssinado, file_get_contents($xsd));
} catch (\Throwable $e) {
    falhar("XSD reprovou:\n" . $e->getMessage());
}

echo "\n✅ SMOKE OK — NF-e montada, assinada e válida contra o XSD 4.00.\n";
echo "   (XML não enviado à SEFAZ; certificado de teste, sem valor fiscal.)\n";
