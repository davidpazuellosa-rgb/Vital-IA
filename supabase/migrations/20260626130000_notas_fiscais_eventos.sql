-- Colunas de notas_fiscais adicionadas após a criação inicial (anexo + eventos pós-autorização).
-- Aditivo e idempotente: funciona tanto em bancos novos quanto nos que já rodaram a migration inicial.
alter table public.notas_fiscais
  add column if not exists anexada_em timestamptz; -- marca idempotente do anexo na contratação
alter table public.notas_fiscais
  add column if not exists cancelamento_justificativa text not null default '';
alter table public.notas_fiscais
  add column if not exists cartas_correcao jsonb not null default '[]'::jsonb; -- histórico de CC-e
