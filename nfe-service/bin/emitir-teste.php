<?php

declare(strict_types=1);

// Emite UMA NF-e de teste em HOMOLOGAÇÃO (sem valor fiscal) para validar a
// transmissão completa (montar→assinar→transmitir→protocolo→DANFE).
// Uso: php bin/emitir-teste.php

require __DIR__ . '/../vendor/autoload.php';

use Vitalia\NfeService\Sefaz;
use Vitalia\NfeService\Transmissor;

$envFile = __DIR__ . '/../.env';
foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
    if ($linha === '' || $linha[0] === '#' || !str_contains($linha, '=')) {
        continue;
    }
    [$k, $v] = explode('=', $linha, 2);
    putenv(trim($k) . '=' . $v);
}

if (!Sefaz::ehHomologacao()) {
    fwrite(STDERR, "Abortado: só roda em homologação (NFE_AMBIENTE=homologacao).\n");
    exit(1);
}

$payload = [
    'natureza_operacao' => 'Venda de mercadoria',
    'tipo_documento' => 1,
    'finalidade_emissao' => 1,
    'consumidor_final' => 1,
    'presenca_comprador' => 9,
    'cnpj_emitente' => Sefaz::env('NFE_CNPJ'),
    'nome_destinatario' => 'CLIENTE TESTE',
    'cnpj_destinatario' => '04365326000173',
    'indicador_inscricao_estadual_destinatario' => 9,
    'logradouro_destinatario' => 'AV BRASIL',
    'numero_destinatario' => '2971',
    'bairro_destinatario' => 'COMPENSA',
    'municipio_destinatario' => 'Manaus',
    'codigo_municipio_destinatario' => '1302603',
    'uf_destinatario' => 'AM',
    'cep_destinatario' => '69036110',
    'informacoes_adicionais_contribuinte' => 'Emissao de teste - sem valor fiscal',
    'items' => [[
        'numero_item' => 1,
        'descricao' => 'PRODUTO TESTE',
        'codigo_ncm' => '87131000',
        'cfop' => '5101',
        'unidade_comercial' => 'UN',
        'quantidade_comercial' => 1,
        'valor_unitario_comercial' => 100.00,
        'valor_bruto' => 100.00,
        'unidade_tributavel' => 'UN',
        'quantidade_tributavel' => 1,
        'valor_unitario_tributavel' => 100.00,
        'icms_origem' => 0,
        'icms_situacao_tributaria' => '102',
        'pis_situacao_tributaria' => '07',
        'cofins_situacao_tributaria' => '07',
    ]],
];

// nNF alto e aleatório p/ não colidir com testes anteriores (evita rejeição 539).
$nNF = random_int(800000, 999999);
echo "Emitindo NF-e de teste (nNF={$nNF}, série 1) em homologação...\n";

try {
    $r = Transmissor::emitir(Sefaz::tools(), $payload, $nNF, 1);
} catch (\Throwable $e) {
    fwrite(STDERR, "❌ " . $e->getMessage() . "\n");
    exit(1);
}

echo "status:    {$r['status']}\n";
echo "cStat:     {$r['cStat']} — {$r['motivo']}\n";
echo "chave:     {$r['chave']}\n";
echo "protocolo: {$r['protocolo']}\n";
echo "XML:       " . strlen(base64_decode($r['xmlBase64'] ?? '')) . " bytes\n";
echo "DANFE:     " . strlen(base64_decode($r['danfeBase64'] ?? '')) . " bytes\n";
echo $r['status'] === 'autorizada'
    ? "\n✅ NOTA AUTORIZADA na SEFAZ-AM (homologação). Integração validada de ponta a ponta!\n"
    : "\n⚠️  Não autorizada — ver cStat acima.\n";
