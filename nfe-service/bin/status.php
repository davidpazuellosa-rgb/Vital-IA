<?php

declare(strict_types=1);

// Checa o status da SEFAZ-AM usando o certificado do .env (handshake da Fase 1).
// Uso (após preencher NFE_CERT_PASSWORD no .env):  php bin/status.php

require __DIR__ . '/../vendor/autoload.php';

use Vitalia\NfeService\Sefaz;

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

if (Sefaz::env('NFE_CERT_PASSWORD') === '') {
    fwrite(STDERR, "⚠️  Preencha NFE_CERT_PASSWORD no .env (a senha do certificado) antes de rodar.\n");
    exit(1);
}

try {
    $std = Sefaz::padronizar(Sefaz::tools()->sefazStatus(Sefaz::env('NFE_UF', 'AM')));
    $cStat = $std->cStat ?? '?';
    echo "Ambiente: " . (Sefaz::ehHomologacao() ? 'homologação' : 'produção') . "\n";
    echo "cStat: {$cStat} — " . ($std->xMotivo ?? '') . "\n";
    echo $cStat === '107'
        ? "✅ SEFAZ-AM operante — handshake OK. Certificado + rede + URLs corretos.\n"
        : "⚠️  Veja o código acima (107 = operante).\n";
} catch (\Throwable $e) {
    fwrite(STDERR, "❌ " . $e->getMessage() . "\n");
    exit(1);
}
