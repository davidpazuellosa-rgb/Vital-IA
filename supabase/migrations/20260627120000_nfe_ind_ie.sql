-- Indicador da IE do destinatário na NF-e: 1 = contribuinte, 2 = isento, 9 = não contribuinte.
-- Aditivo e idempotente. Quando nulo, a emissão deriva do antigo comportamento (IE → 1, senão 9).
alter table public.notas_fiscais
  add column if not exists destinatario_ind_ie integer;
