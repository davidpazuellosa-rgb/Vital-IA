<?php

declare(strict_types=1);

// Roteador único do microserviço NF-e. Contrato espelha src/lib/nota-fiscal/sefaz.ts
// no Vital.IA. Autenticação: Bearer NFE_SERVICE_TOKEN.

// Fuso de Manaus (UTC-4, sem horário de verão) — garante dhEmi/idLote corretos
// mesmo que o container rode em UTC.
date_default_timezone_set('America/Manaus');

require __DIR__ . '/../vendor/autoload.php';

use Vitalia\NfeService\Sefaz;
use Vitalia\NfeService\Transmissor;

function corpoJson(): array
{
    return json_decode((string) file_get_contents('php://input'), true) ?? [];
}

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

    // ── Emitir: POST /nfe (corpo = payload do app + numero/serie) ──
    // ⚠️ contrato AINDA não validado: o payload precisa incluir `numero` (nNF),
    // `serie` e `codigo_municipio_destinatario`. Ver MORNING-HANDOFF.md.
    if ($metodo === 'POST' && $caminho === '/nfe') {
        $payload = corpoJson();
        $numero = (int) ($payload['numero'] ?? 0);
        $serie = (int) ($payload['serie'] ?? 1);
        if ($numero <= 0) {
            responder(400, ['erro' => 'Falta "numero" (nNF) no payload — o app aloca a numeração sequencial por série.']);
        }
        responder(200, Transmissor::emitir(Sefaz::tools(), $payload, $numero, $serie));
    }

    // ── Consulta cadastro: GET /consulta-cadastro?cnpj=&uf= (padrão: emitente/AM) ──
    if ($metodo === 'GET' && $caminho === '/consulta-cadastro') {
        $cnpj = preg_replace('/\D/', '', (string) ($_GET['cnpj'] ?? Sefaz::env('NFE_CNPJ')));
        $uf = strtoupper((string) ($_GET['uf'] ?? Sefaz::env('NFE_UF', 'AM')));
        responder(200, Transmissor::consultarCadastro(Sefaz::tools(), $cnpj, $uf));
    }

    // ── Consultar: GET /nfe/{chave44} ──
    if ($metodo === 'GET' && preg_match('#^/nfe/(\d{44})$#', $caminho, $m)) {
        responder(200, Transmissor::consultar(Sefaz::tools(), $m[1]));
    }

    // ── Cancelar: DELETE /nfe/{chave44} (corpo: justificativa, protocolo) ──
    if ($metodo === 'DELETE' && preg_match('#^/nfe/(\d{44})$#', $caminho, $m)) {
        $b = corpoJson();
        $just = trim((string) ($b['justificativa'] ?? ''));
        $prot = (string) ($b['protocolo'] ?? '');
        if (mb_strlen($just) < 15 || $prot === '') {
            responder(400, ['erro' => 'Cancelamento exige justificativa (≥15 caracteres) e protocolo de autorização.']);
        }
        responder(200, Transmissor::cancelar(Sefaz::tools(), $m[1], $just, $prot));
    }

    // ── Carta de correção: POST /nfe/{chave44}/carta-correcao (corpo: correcao, seq?) ──
    if ($metodo === 'POST' && preg_match('#^/nfe/(\d{44})/carta-correcao$#', $caminho, $m)) {
        $b = corpoJson();
        $r = Transmissor::cartaCorrecao(Sefaz::tools(), $m[1], (string) ($b['correcao'] ?? ''), (int) ($b['seq'] ?? 1));
        // TODO Fase 4: gerar o PDF da CC-e e devolver ccePdfUrl.
        responder(200, ['ccePdfUrl' => '', 'cStat' => $r['cStat'], 'motivo' => $r['motivo'], 'ok' => $r['ok']]);
    }

    responder(404, ['erro' => 'Rota não encontrada.']);
} catch (\Throwable $e) {
    responder(500, ['erro' => $e->getMessage()]);
}
