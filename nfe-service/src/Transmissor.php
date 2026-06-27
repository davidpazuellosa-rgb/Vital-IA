<?php

declare(strict_types=1);

namespace Vitalia\NfeService;

use NFePHP\Common\Exception\SoapException;
use NFePHP\DA\NFe\Danfe;
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
        $xmlMontado = Emissor::montar($payload, $nNF, $serie);

        // Transmite; se a SEFAZ-AM estiver indisponível, cai para contingência SVC-RS.
        [$std, $resp, $assinado, $contingencia] = self::transmitir($tools, $xmlMontado);
        $chave = Emissor::chaveDe($assinado);

        // Em lote síncrono o protNFe vem em protNFe; o cStat relevante é o do protocolo.
        $prot = $std->protNFe->infProt ?? null;
        $cStat = (string) ($prot->cStat ?? $std->cStat ?? '');
        $xMotivo = (string) ($prot->xMotivo ?? $std->xMotivo ?? '');
        $protocolo = (string) ($prot->nProt ?? '');
        $status = self::statusAutorizacao($cStat);

        $xmlAutorizado = '';
        $danfeBase64 = '';
        if ($status === 'autorizada' && $protocolo !== '') {
            // Anexa o protocolo ao XML → nfeProc (documento fiscal definitivo p/ guarda).
            $xmlAutorizado = Complements::toAuthorize($assinado, $resp);
            // DANFE (PDF). É só a representação — não falha a emissão se der erro aqui.
            try {
                $danfeBase64 = base64_encode((new Danfe($xmlAutorizado))->render());
            } catch (\Throwable $e) {
                $danfeBase64 = '';
            }
        }

        return [
            'status' => $status,
            'numero' => (string) $nNF,
            'serie' => (string) $serie,
            'motivo' => $xMotivo,
            'cStat' => $cStat,
            'chave' => $chave,
            'protocolo' => $protocolo,
            'contingencia' => $contingencia,
            'xmlBase64' => base64_encode($xmlAutorizado !== '' ? $xmlAutorizado : $assinado),
            'danfeBase64' => $danfeBase64,
        ];
    }

    /**
     * Transmite o lote síncrono. Se a SEFAZ-AM estiver paralisada (cStat 108/109)
     * ou inacessível (falha de transporte), ativa a contingência SVC-RS — o
     * autorizador de contingência do AM —, reassina (a sped-nfe ajusta tpEmis=7 +
     * dhCont + xJust e recalcula a chave) e reenvia.
     * Retorna [stdPadronizado, respostaXml, xmlAssinadoTransmitido, emContingencia].
     *
     * @return array{0:\stdClass,1:string,2:string,3:bool}
     */
    private static function transmitir(Tools $tools, string $xmlMontado): array
    {
        $assinado = Emissor::assinar($tools, $xmlMontado);
        try {
            $resp = $tools->sefazEnviaLote([$assinado], date('YmdHis'), 1);
            $std = Sefaz::padronizar($resp);
            if (!self::sefazIndisponivel((string) ($std->cStat ?? ''))) {
                return [$std, $resp, $assinado, false];
            }
        } catch (SoapException $e) {
            // Só falha de transporte/SOAP (SEFAZ-AM inacessível) cai em contingência.
            // Erros de schema/validação propagam — devem aflorar como rejeição, não SVC-RS.
        }

        $uf = Sefaz::env('NFE_UF', 'AM');
        $tools->contingency->activate($uf, 'SEFAZ-AM indisponivel - emissao em contingencia SVC-RS', 'SVCRS');
        try {
            // Reassina o MESMO XML montado: a sped-nfe converte para SVC-RS (tpEmis 7),
            // insere dhCont/xJust e recalcula a chave de acesso.
            $assinadoCont = Emissor::assinar($tools, $xmlMontado);
            $resp = $tools->sefazEnviaLote([$assinadoCont], date('YmdHis'), 1);
            $std = Sefaz::padronizar($resp);
            return [$std, $resp, $assinadoCont, true];
        } finally {
            // Sempre volta ao modo normal para não contaminar a próxima emissão.
            $tools->contingency->deactivate();
        }
    }

    /** cStat de serviço paralisado: 108 (momentâneo) / 109 (sem previsão). */
    private static function sefazIndisponivel(string $cStat): bool
    {
        return in_array($cStat, ['108', '109'], true);
    }

    /**
     * Consulta o cadastro do contribuinte na SEFAZ: situação da Inscrição Estadual
     * e credenciamento para NF-e. Serve para confirmar, direto na fonte, se o CNPJ
     * está apto a emitir em produção (cSit=1 habilitada; indCredNFe 1/2/3 credenciado).
     */
    public static function consultarCadastro(Tools $tools, string $cnpj, string $uf): array
    {
        $std = Sefaz::padronizar($tools->sefazCadastro($uf, $cnpj));
        // O retConsCad aninha tudo sob <infCons>: { cStat, xMotivo, infCad[0..n] }.
        $cons = $std->infCons ?? $std;
        $info = $cons->infCad ?? null;
        if (is_array($info)) {
            $info = $info[0] ?? null; // múltiplas IEs → usa a primeira ocorrência
        }
        $cSit = isset($info->cSit) ? (string) $info->cSit : '';
        $indCredNFe = isset($info->indCredNFe) ? (string) $info->indCredNFe : '';
        return [
            'cStat' => (string) ($cons->cStat ?? ''),
            'motivo' => (string) ($cons->xMotivo ?? ''),
            'xNome' => (string) ($info->xNome ?? ''),
            'IE' => (string) ($info->IE ?? ''),
            'cSit' => $cSit,             // 1 = habilitada
            'indCredNFe' => $indCredNFe, // 1/2/3 = credenciado a emitir NF-e
            'ieHabilitada' => $cSit === '1',
            'credenciadoNFe' => in_array($indCredNFe, ['1', '2', '3'], true),
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
