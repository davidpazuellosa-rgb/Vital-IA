<?php

declare(strict_types=1);

// Consulta o cadastro do CNPJ emitente na SEFAZ: situação da IE + credenciamento NF-e.
// Responde, direto da fonte, se o CNPJ está apto a emitir em produção.
// Uso:  php bin/consulta-cadastro.php [homologacao]
//   (padrão: produção — é onde está o cadastro real; a consulta é só leitura, não emite nada.)

require __DIR__ . '/../vendor/autoload.php';

use Vitalia\NfeService\Sefaz;
use Vitalia\NfeService\Transmissor;

// Carrega o .env para as variáveis de ambiente do processo.
$envFile = __DIR__ . '/../.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
        if ($linha === '' || $linha[0] === '#' || !str_contains($linha, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $linha, 2);
        putenv(trim($k) . '=' . $v);
    }
}

// A consulta de cadastro só faz sentido contra o cadastro REAL (produção).
$ambiente = ($argv[1] ?? 'producao') === 'homologacao' ? 'homologacao' : 'producao';
putenv('NFE_AMBIENTE=' . $ambiente);

if (Sefaz::env('NFE_CERT_PASSWORD') === '') {
    fwrite(STDERR, "⚠️  Preencha NFE_CERT_PASSWORD no .env antes de rodar.\n");
    exit(1);
}

$cnpj = preg_replace('/\D/', '', Sefaz::env('NFE_CNPJ'));
$uf = strtoupper(Sefaz::env('NFE_UF', 'AM'));

try {
    $r = Transmissor::consultarCadastro(Sefaz::tools(), $cnpj, $uf);
    echo "Ambiente da consulta: {$ambiente} (somente leitura)\n";
    echo "CNPJ: {$cnpj}   UF: {$uf}\n";
    echo "cStat: {$r['cStat']} — {$r['motivo']}\n";
    echo "Razão social: {$r['xNome']}\n";
    echo "IE: {$r['IE']}\n";
    echo "Situação da IE (cSit {$r['cSit']}): " . ($r['ieHabilitada'] ? 'HABILITADA ✅' : 'NÃO habilitada ⚠️') . "\n";
    echo "Credenciamento NF-e (indCredNFe {$r['indCredNFe']}): " . ($r['credenciadoNFe'] ? 'CREDENCIADO ✅' : 'NÃO credenciado ⚠️') . "\n\n";
    echo $r['ieHabilitada'] && $r['credenciadoNFe']
        ? "✅ CNPJ apto a emitir NF-e em produção na SEFAZ-{$uf}.\n"
        : "⚠️  IE/credenciamento ainda não confirmados — conferir com a contabilidade antes de ligar produção.\n";
} catch (\Throwable $e) {
    fwrite(STDERR, "❌ " . $e->getMessage() . "\n");
    fwrite(STDERR, "ℹ️  A SEFAZ-{$uf} pode não oferecer ConsultaCadastro neste ambiente; nesse caso confirme a IE pelo portal/contabilidade.\n");
    exit(1);
}
