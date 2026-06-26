<?php

declare(strict_types=1);

// Roteador único do microserviço NF-e. Contrato espelha src/lib/nota-fiscal/sefaz.ts
// no Vital.IA. Autenticação: Bearer NFE_SERVICE_TOKEN.

require __DIR__ . '/../vendor/autoload.php';

use Vitalia\NfeService\Sefaz;

header('Content-Type: application/json; charset=utf-8');

function responder(int $status, array $corpo): never
{
    http_response_code($status);
    echo json_encode($corpo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function autenticar(): void
{
    $esperado = Sefaz::env('NFE_SERVICE_TOKEN');
    $recebido = '';
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) {
        $recebido = trim($m[1]);
    }
    if ($esperado === '' || !hash_equals($esperado, $recebido)) {
        responder(401, ['erro' => 'Não autorizado.']);
    }
}

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$caminho = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/') ?: '/';

// Liveness — não exige token nem certificado (usado por health checks do host).
if ($metodo === 'GET' && $caminho === '/health') {
    responder(200, [
        'ok' => true,
        'modelo' => '55',
        'ambiente' => Sefaz::ehHomologacao() ? 'homologacao' : 'producao',
    ]);
}

autenticar();

try {
    // Fase 1 — handshake: confirma certificado + rede + URLs da SEFAZ-AM.
    if ($metodo === 'GET' && $caminho === '/status-servico') {
        $tools = Sefaz::tools();
        $std = Sefaz::padronizar($tools->sefazStatus(Sefaz::env('NFE_UF', 'AM')));
        responder(200, [
            'cStat' => $std->cStat ?? null,
            'xMotivo' => $std->xMotivo ?? null,
            'tpAmb' => $std->tpAmb ?? Sefaz::tpAmb(),
            'ambiente' => Sefaz::ehHomologacao() ? 'homologacao' : 'producao',
            // cStat 107 = "Serviço em Operação" → handshake OK.
            'operante' => (($std->cStat ?? '') === '107'),
        ]);
    }

    // Fases 2–3 (emitir/consultar), 6 (cancelar/CC-e) — ainda não implementadas.
    if (preg_match('#^/nfe#', $caminho)) {
        responder(501, ['erro' => 'Emissão ainda não implementada (Fase 2+ do PLAN-sefaz-direto.md).']);
    }

    responder(404, ['erro' => 'Rota não encontrada.']);
} catch (\Throwable $e) {
    responder(500, ['erro' => $e->getMessage()]);
}
