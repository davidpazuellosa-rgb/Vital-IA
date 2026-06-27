<?php

declare(strict_types=1);

// Teste de FLUXO COMPLETO em HOMOLOGAÇÃO (sem valor fiscal): emite → consulta →
// carta de correção → cancela. Valida a operação por CHAVE/PROTOCOLO e revela
// qualquer rejeição nos campos fiscais (CSOSN/CST/tPag) antes da produção.
// Uso:  php bin/teste-fluxo.php

date_default_timezone_set('America/Manaus');
require __DIR__ . '/../vendor/autoload.php';

use Vitalia\NfeService\Sefaz;
use Vitalia\NfeService\Transmissor;

$envFile = __DIR__ . '/../.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $l) {
        if ($l === '' || $l[0] === '#' || !str_contains($l, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $l, 2);
        putenv(trim($k) . '=' . $v);
    }
}
putenv('NFE_AMBIENTE=homologacao'); // força homologação — NUNCA emite nota real

if (Sefaz::env('NFE_CERT_PASSWORD') === '') {
    fwrite(STDERR, "Preencha NFE_CERT_PASSWORD no .env.\n");
    exit(1);
}

$tools = Sefaz::tools();
$payload = [
    'natureza_operacao' => 'Venda de mercadoria',
    'tipo_documento' => 1,
    'finalidade_emissao' => 1,
    'consumidor_final' => 1,
    'presenca_comprador' => 9,
    'cnpj_emitente' => Sefaz::env('NFE_CNPJ'),
    'nome_destinatario' => 'Cliente Teste Homologacao',
    'cnpj_destinatario' => '11222333000181',
    'indicador_inscricao_estadual_destinatario' => 9,
    'logradouro_destinatario' => 'Rua Teste',
    'numero_destinatario' => '100',
    'bairro_destinatario' => 'Centro',
    'municipio_destinatario' => 'Manaus',
    'codigo_municipio_destinatario' => '1302603',
    'uf_destinatario' => 'AM',
    'cep_destinatario' => '69005000',
    'items' => [[
        'numero_item' => 1,
        'codigo_produto' => 'TESTE-1',
        'descricao' => 'Acucar cristal',
        'codigo_ncm' => '17019900',
        'cfop' => '5101',
        'unidade_comercial' => 'KG',
        'quantidade_comercial' => 10,
        'valor_unitario_comercial' => 4.50,
        'valor_bruto' => 45.00,
        'unidade_tributavel' => 'KG',
        'quantidade_tributavel' => 10,
        'valor_unitario_tributavel' => 4.50,
        'icms_origem' => 0,
        'icms_situacao_tributaria' => '102',
        'pis_situacao_tributaria' => '07',
        'cofins_situacao_tributaria' => '07',
    ]],
];

$nNF = random_int(900000000, 999999990);
echo "== EMITIR (homologação) nNF={$nNF} ==\n";
$r = Transmissor::emitir($tools, $payload, $nNF, 1);
echo "status={$r['status']} cStat={$r['cStat']} contingencia=" . ($r['contingencia'] ? 'sim' : 'nao') . "\n";
echo "motivo={$r['motivo']}\n";
echo "chave={$r['chave']}\nprotocolo={$r['protocolo']}\n";
if ($r['status'] !== 'autorizada') {
    fwrite(STDERR, "Emissão NÃO autorizada — corrigir antes de testar os eventos.\n");
    exit(2);
}
$chave = $r['chave'];
$prot = $r['protocolo'];

echo "\n== CONSULTAR (por chave) ==\n";
$c = Transmissor::consultar($tools, $chave);
echo "status={$c['status']} cStat={$c['cStat']} protocolo={$c['protocolo']}\n";

echo "\n== CARTA DE CORRECAO (por chave) ==\n";
$cc = Transmissor::cartaCorrecao($tools, $chave, 'Correcao de teste em homologacao, sem valor fiscal.', 1);
echo "ok=" . ($cc['ok'] ? '1' : '0') . " cStat={$cc['cStat']} motivo={$cc['motivo']}\n";

echo "\n== CANCELAR (por chave + protocolo) ==\n";
$cn = Transmissor::cancelar($tools, $chave, 'Cancelamento de teste em homologacao, sem valor fiscal.', $prot);
echo "status={$cn['status']} cStat={$cn['cStat']} motivo={$cn['motivo']}\n";

echo "\n✅ Fluxo completo exercitado em homologação (emitir/consultar/CC-e/cancelar).\n";
