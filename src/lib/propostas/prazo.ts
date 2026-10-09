export type NivelPrazo = "ok" | "atencao" | "urgente" | "encerrado";

/** Situação do prazo de envio das propostas (usado no diálogo de envio e no painel "Em andamento"). */
export function prazoDe(encerramento: string | null, agora: number = Date.now()): { texto: string; nivel: NivelPrazo } {
  if (!encerramento) return { texto: "Prazo não informado", nivel: "atencao" };
  const ms = new Date(encerramento).getTime() - agora;
  if (ms <= 0) return { texto: "Prazo encerrado", nivel: "encerrado" };
  const horas = ms / 3_600_000;
  if (horas < 24) return { texto: `Encerra em ${Math.max(1, Math.floor(horas))}h`, nivel: "urgente" };
  const dias = Math.floor(horas / 24);
  return { texto: `Encerra em ${dias} dia${dias > 1 ? "s" : ""}`, nivel: dias <= 2 ? "atencao" : "ok" };
}

export const COR_NIVEL_PRAZO: Record<NivelPrazo, string> = {
  ok: "border-transparent bg-primary/10 text-primary",
  atencao: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
  urgente: "border-transparent bg-destructive/12 text-destructive",
  encerrado: "border-transparent bg-destructive/12 text-destructive",
};
