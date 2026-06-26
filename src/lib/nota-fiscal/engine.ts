import type { NotaFiscalStatus, ResultadoEmissao } from "./types";
import * as focus from "./focus";
import * as sefaz from "./sefaz";

// Seleciona o motor de emissão de NF-e em tempo de execução.
//   NFE_ENGINE=focus  (padrão) → provedor Focus NFe (focus.ts)
//   NFE_ENGINE=sefaz           → integração direta com a SEFAZ (sefaz.ts)
//
// O app inteiro importa daqui (não de focus.ts/sefaz.ts), então trocar de motor
// — ou fazer rollback — é só mudar a env, sem tocar em actions/webhook/UI.

/** Contrato comum dos motores. Os dois módulos precisam satisfazê-lo (checado no compilador). */
type MotorNFe = {
  emitirNFe(ref: string, payload: Record<string, unknown>): Promise<ResultadoEmissao>;
  consultarNFe(ref: string): Promise<ResultadoEmissao>;
  cancelarNFe(ref: string, justificativa: string): Promise<NotaFiscalStatus>;
  cartaCorrecaoNFe(ref: string, correcao: string): Promise<{ ccePdfUrl: string }>;
  baixarArquivo(url: string): Promise<{ conteudo: ArrayBuffer; contentType: string }>;
  ehHomologacao(): boolean;
};

const focusMotor: MotorNFe = focus;
const sefazMotor: MotorNFe = sefaz;

const usaSefaz = (process.env.NFE_ENGINE ?? "focus").toLowerCase() === "sefaz";
const motor: MotorNFe = usaSefaz ? sefazMotor : focusMotor;

export const emitirNFe = motor.emitirNFe;
export const consultarNFe = motor.consultarNFe;
export const cancelarNFe = motor.cancelarNFe;
export const cartaCorrecaoNFe = motor.cartaCorrecaoNFe;
export const baixarArquivo = motor.baixarArquivo;
export const ehHomologacao = motor.ehHomologacao;
