<?php

declare(strict_types=1);

namespace Vitalia\NfeService;

use NFePHP\NFe\Complements;
use NFePHP\NFe\Tools;

/**
 * Transmissão e eventos junto à SEFAZ-AM (Fases 3 e 6).
 *
 * ⚠️ NÃO VALIDADO EM EXECUÇÃO (sem cert/credenciamento na máquina de dev).
 *
 * Decisão de estado: o microserviço é STATELESS. Quem persiste a nota é o app
 * (Supabase). Por isso:
 *  - emitir() devolve chave + protocolo + numero + XML autorizado; o app guarda.
 *  - consultar()/cancelar()/cartaCorrecao() recebem a CHAVE (e o protocolo no
 *    cancelamento) que o app guardou — não há lookup por `ref` aqui.
 * Ver MORNING-HANDOFF.md para o que o app precisa armazenar/enviar.
 */
final class Transmissor
{
    /** Mapeia cStat de autorização/consulta para o enum do app. */
    private static function statusAutorizacao(string $cStat): string
    {
        return match ($cStat) {
            '100', '150' => 'autorizada',
            '101', '135', '151', '155' => 'cancelada',
            '103', '105' => 'processando', // lote recebido / em processamento
            '110', '301', '302', '303' => 'rejeitada', // denegada
            default => 'rejeitada',
        };
    }

    /**
     * Monta, assina e transmite (lote síncrono). `nNF`/`serie` vêm do app.
     * Retorna o resultado já no formato neutro + chave/protocolo/XML p/ o app guardar.
     */
    public static function emitir(Tools $tools, array $payload, int $nNF, int $serie): array
    {
        $xml = Emissor::montar($payload, $nNF, $serie);
        $assinado = Emissor::assinar($tools, $xml);
        $chave = Emissor::chaveDe($assinado);

        // indSinc=1 → resposta síncrona com o protocolo embutido.
        $resp = $tools->sefazEnviaLote([$assinado], date('YmdHis'), 1);
        $std = Sefaz::padronizar($resp);

        // Em lote síncrono o protNFe vem em protNFe; o cStat relevante é o do protocolo.
        $prot = $std->protNFe->infProt ?? null;
        $cStat = (string) ($prot->cStat ?? $std->cStat ?? '');
        $xMotivo = (string) ($prot->xMotivo ?? $std->xMotivo ?? '');
        $protocolo = (string) ($prot->nProt ?? '');
        $status = self::statusAutorizacao($cStat);

        $xmlAutorizado = '';
        if ($status === 'autorizada' && $protocolo !== '') {
            // Anexa o protocolo ao XML → nfeProc (documento fiscal definitivo p/ guarda).
            $xmlAutorizado = Complements::toAuthorize($assinado, $resp);
        }

        return [
            'status' => $status,
            'numero' => (string) $nNF,
            'serie' => (string) $serie,
            'motivo' => $xMotivo,
            'cStat' => $cStat,
            'chave' => $chave,
            'protocolo' => $protocolo,
            'xmlBase64' => base64_encode($xmlAutorizado !== '' ? $xmlAutorizado : $assinado),
        ];
    }

    /** Consulta a situação de uma NF-e pela chave de acesso. */
    public static function consultar(Tools $tools, string $chave): array
    {
        $std = Sefaz::padronizar($tools->sefazConsultaChave($chave));
        $prot = $std->protNFe->infProt ?? null;
        $cStat = (string) ($prot->cStat ?? $std->cStat ?? '');
        return [
            'status' => self::statusAutorizacao($cStat),
            'motivo' => (string) ($prot->xMotivo ?? $std->xMotivo ?? ''),
            'cStat' => $cStat,
            'chave' => $chave,
            'protocolo' => (string) ($prot->nProt ?? ''),
        ];
    }

    /** Cancela uma NF-e autorizada (precisa da chave + protocolo de autorização). */
    public static function cancelar(Tools $tools, string $chave, string $justificativa, string $protocolo): array
    {
        $std = Sefaz::padronizar($tools->sefazCancela($chave, $justificativa, $protocolo));
        // Em evento, o resultado vem em retEvento->infEvento.
        $info = $std->retEvento->infEvento ?? $std;
        $cStat = (string) ($info->cStat ?? '');
        $ok = in_array($cStat, ['101', '135', '155'], true);
        return [
            'status' => $ok ? 'cancelada' : 'processando',
            'motivo' => (string) ($info->xMotivo ?? ''),
            'cStat' => $cStat,
        ];
    }

    /** Registra uma carta de correção (CC-e). `nSeq` é a sequência do evento (1..20). */
    public static function cartaCorrecao(Tools $tools, string $chave, string $correcao, int $nSeq = 1): array
    {
        $std = Sefaz::padronizar($tools->sefazCCe($chave, $correcao, $nSeq));
        $info = $std->retEvento->infEvento ?? $std;
        $cStat = (string) ($info->cStat ?? '');
        return [
            'ok' => in_array($cStat, ['135', '136'], true),
            'motivo' => (string) ($info->xMotivo ?? ''),
            'cStat' => $cStat,
        ];
    }
}
