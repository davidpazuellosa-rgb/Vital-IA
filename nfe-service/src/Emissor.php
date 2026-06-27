<?php

declare(strict_types=1);

namespace Vitalia\NfeService;

use NFePHP\NFe\Make;
use NFePHP\NFe\Tools;

/**
 * Monta, assina e transmite a NF-e (modelo 55) a partir do payload que o
 * Vital.IA já produz (mesmo formato do provedor Focus — ver montarPayloadFocus
 * em src/lib/nota-fiscal/actions.ts).
 *
 * ⚠️ NÃO VALIDADO EM EXECUÇÃO ainda (escrito sem PHP/Docker/certificado na
 * máquina de dev). A validação real é o smoke test (bin/smoke.php) + emissão em
 * homologação. Os nomes de métodos da sped-nfe seguem a v5; ajustar se o
 * build/XSD acusar divergência.
 *
 * LACUNAS que o app precisa preencher no payload (hoje ausentes):
 *  - `codigo_municipio_destinatario` (IBGE 7 díg.) — a NF-e exige cMun, não o nome.
 *  - `numero` (nNF) e `serie` — numeração sequencial sem buracos é responsabilidade
 *    do emitente; o app deve alocar e enviar (ver MORNING-HANDOFF / Fase 3).
 */
final class Emissor
{
    /** Monta o XML (sem assinar) a partir do payload. Lança em dado faltante. */
    public static function montar(array $p, int $nNF, int $serie): string
    {
        // Garante dhEmi no fuso de Manaus (UTC-4) independentemente do host.
        date_default_timezone_set('America/Manaus');
        $make = new Make();
        $emit = Sefaz::emitente();

        $infNFe = new \stdClass();
        $infNFe->versao = '4.00';
        $make->taginfNFe($infNFe);

        // ── ide ──
        $ufDest = strtoupper((string) ($p['uf_destinatario'] ?? ''));
        $interestadual = $ufDest !== '' && $ufDest !== strtoupper($emit['UF']);

        $ide = new \stdClass();
        $ide->cUF = Sefaz::cUF();
        $ide->cNF = str_pad((string) random_int(0, 99999999), 8, '0', STR_PAD_LEFT);
        $ide->natOp = (string) ($p['natureza_operacao'] ?? 'Venda');
        $ide->mod = 55;
        $ide->serie = $serie;
        $ide->nNF = $nNF;
        $ide->dhEmi = date('Y-m-d\TH:i:sP');
        $ide->tpNF = (int) ($p['tipo_documento'] ?? 1); // 1 = saída
        $ide->idDest = $interestadual ? 2 : 1; // 1 interna, 2 interestadual, 3 exterior
        $ide->cMunFG = $emit['cMun'];
        $ide->tpImp = 1; // DANFE retrato
        $ide->tpEmis = 1; // emissão normal
        $ide->tpAmb = Sefaz::tpAmb();
        $ide->finNFe = (int) ($p['finalidade_emissao'] ?? 1);
        $ide->indFinal = (int) ($p['consumidor_final'] ?? 1);
        $ide->indPres = (int) ($p['presenca_comprador'] ?? 9);
        $ide->procEmi = 0;
        $ide->verProc = 'VitalIA-1.0';
        $make->tagide($ide);

        // ── emitente ──
        $e = new \stdClass();
        $e->xNome = $emit['xNome'];
        $e->CNPJ = preg_replace('/\D/', '', (string) ($p['cnpj_emitente'] ?? $emit['CNPJ']));
        $e->IE = $emit['IE'];
        $e->CRT = $emit['CRT'];
        $make->tagemit($e);

        $ee = new \stdClass();
        $ee->xLgr = $emit['xLgr'];
        $ee->nro = $emit['nro'];
        $ee->xBairro = $emit['xBairro'];
        $ee->cMun = $emit['cMun'];
        $ee->xMun = $emit['xMun'];
        $ee->UF = $emit['UF'];
        $ee->CEP = $emit['CEP'];
        $ee->cPais = '1058';
        $ee->xPais = 'BRASIL';
        if (!empty($emit['fone'])) {
            $ee->fone = $emit['fone'];
        }
        $make->tagenderemit($ee);

        // ── destinatário ──
        $doc = preg_replace('/\D/', '', (string) ($p['cnpj_destinatario'] ?? $p['cpf_destinatario'] ?? ''));
        $d = new \stdClass();
        $d->xNome = (string) ($p['nome_destinatario'] ?? '');
        if (strlen($doc) === 14) {
            $d->CNPJ = $doc;
        } else {
            $d->CPF = $doc;
        }
        $d->indIEDest = (int) ($p['indicador_inscricao_estadual_destinatario'] ?? 9);
        if (!empty($p['inscricao_estadual_destinatario'])) {
            $d->IE = preg_replace('/\D/', '', (string) $p['inscricao_estadual_destinatario']);
        }
        // Em homologação a SEFAZ exige este nome fixo no destinatário.
        if (Sefaz::ehHomologacao()) {
            $d->xNome = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
        }
        $make->tagdest($d);

        $cMunDest = preg_replace('/\D/', '', (string) ($p['codigo_municipio_destinatario'] ?? ''));
        if ($cMunDest === '') {
            throw new \RuntimeException(
                'Falta codigo_municipio_destinatario (IBGE 7 díg.) no payload — o app precisa enviá-lo.',
            );
        }
        $ed = new \stdClass();
        $ed->xLgr = (string) ($p['logradouro_destinatario'] ?? '');
        $ed->nro = (string) ($p['numero_destinatario'] ?? 'S/N');
        $ed->xBairro = (string) ($p['bairro_destinatario'] ?? '');
        $ed->cMun = $cMunDest;
        $ed->xMun = (string) ($p['municipio_destinatario'] ?? '');
        $ed->UF = $ufDest;
        $ed->CEP = preg_replace('/\D/', '', (string) ($p['cep_destinatario'] ?? ''));
        $ed->cPais = '1058';
        $ed->xPais = 'BRASIL';
        $make->tagenderdest($ed);

        // ── itens ──
        $vProdTotal = 0.0;
        foreach (($p['items'] ?? []) as $i => $item) {
            $n = (int) ($item['numero_item'] ?? $i + 1);
            $vProd = round((float) ($item['valor_bruto'] ?? 0), 2);
            $vProdTotal += $vProd;

            $prod = new \stdClass();
            $prod->item = $n;
            $prod->cProd = (string) ($item['codigo_produto'] ?? "ITEM-$n");
            $prod->cEAN = 'SEM GTIN';
            $prod->xProd = Sefaz::ehHomologacao() && $n === 1
                ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
                : (string) ($item['descricao'] ?? '');
            $prod->NCM = (string) ($item['codigo_ncm'] ?? '');
            $prod->CFOP = (string) ($item['cfop'] ?? '');
            $prod->uCom = (string) ($item['unidade_comercial'] ?? 'UN');
            $prod->qCom = (float) ($item['quantidade_comercial'] ?? 0);
            $prod->vUnCom = (float) ($item['valor_unitario_comercial'] ?? 0);
            $prod->vProd = $vProd;
            $prod->cEANTrib = 'SEM GTIN';
            $prod->uTrib = (string) ($item['unidade_tributavel'] ?? $prod->uCom);
            $prod->qTrib = (float) ($item['quantidade_tributavel'] ?? $prod->qCom);
            $prod->vUnTrib = (float) ($item['valor_unitario_tributavel'] ?? $prod->vUnCom);
            $prod->indTot = 1;
            $make->tagprod($prod);

            $imp = new \stdClass();
            $imp->item = $n;
            $make->tagimposto($imp);

            // ICMS Simples Nacional (CSOSN 102: sem permissão de crédito).
            $icms = new \stdClass();
            $icms->item = $n;
            $icms->orig = (int) ($item['icms_origem'] ?? 0);
            $icms->CSOSN = (string) ($item['icms_situacao_tributaria'] ?? '102');
            $make->tagICMSSN($icms);

            // PIS/COFINS CST 07 (isenta) — sem base/alíquota.
            $pis = new \stdClass();
            $pis->item = $n;
            $pis->CST = (string) ($item['pis_situacao_tributaria'] ?? '07');
            $make->tagPIS($pis);

            $cofins = new \stdClass();
            $cofins->item = $n;
            $cofins->CST = (string) ($item['cofins_situacao_tributaria'] ?? '07');
            $make->tagCOFINS($cofins);
        }

        // ── totais (Simples isento: tributos zerados, só o valor dos produtos) ──
        $vProdTotal = round($vProdTotal, 2);
        $tot = new \stdClass();
        $tot->vBC = 0.00;
        $tot->vICMS = 0.00;
        $tot->vICMSDeson = 0.00;
        $tot->vFCP = 0.00;
        $tot->vBCST = 0.00;
        $tot->vST = 0.00;
        $tot->vFCPST = 0.00;
        $tot->vFCPSTRet = 0.00;
        $tot->vProd = $vProdTotal;
        $tot->vFrete = 0.00;
        $tot->vSeg = 0.00;
        $tot->vDesc = 0.00;
        $tot->vII = 0.00;
        $tot->vIPI = 0.00;
        $tot->vIPIDevol = 0.00;
        $tot->vPIS = 0.00;
        $tot->vCOFINS = 0.00;
        $tot->vOutro = 0.00;
        $tot->vNF = $vProdTotal;
        $make->tagICMSTot($tot);

        // ── transporte: sem ocorrência ──
        $transp = new \stdClass();
        $transp->modFrete = 9;
        $make->tagtransp($transp);

        // ── pagamento: sem pagamento (típico em nota a órgão público) ──
        $make->tagpag(new \stdClass());
        $pag = new \stdClass();
        $pag->tPag = '90'; // sem pagamento
        $pag->vPag = 0.00;
        $make->tagdetPag($pag);

        // ── informações adicionais ──
        if (!empty($p['informacoes_adicionais_contribuinte'])) {
            $inf = new \stdClass();
            $inf->infCpl = (string) $p['informacoes_adicionais_contribuinte'];
            $make->taginfAdic($inf);
        }

        // ── responsável técnico (obrigatório no layout 4.00) ──
        $rt = new \stdClass();
        $rt->CNPJ = $emit['CNPJ'];
        $rt->xContato = mb_substr($emit['xNome'] ?: 'Responsavel Tecnico', 0, 60);
        $rt->email = $emit['email'] ?: 'contato@example.com';
        $rt->fone = $emit['fone'] ?: '0000000000';
        $make->taginfRespTec($rt);

        $xml = $make->montaNFe();
        if ($xml === '' || count($make->getErrors()) > 0) {
            throw new \RuntimeException('Erro ao montar a NF-e: ' . implode(' | ', $make->getErrors()));
        }
        return $xml;
    }

    /** Assina o XML com o certificado A1 (XMLDSig). */
    public static function assinar(Tools $tools, string $xml): string
    {
        return $tools->signNFe($xml);
    }

    /** Extrai a chave de acesso (44 díg.) de um XML de NF-e. */
    public static function chaveDe(string $xml): string
    {
        if (preg_match('/Id="NFe(\d{44})"/', $xml, $m)) {
            return $m[1];
        }
        return '';
    }
}
