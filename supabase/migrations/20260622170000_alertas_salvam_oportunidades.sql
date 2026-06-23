-- Salva automaticamente em "Minhas licitações" as oportunidades encontradas por alertas.

alter table public.saved_licitacoes
  add column if not exists salvo_por_alerta boolean not null default false,
  add column if not exists alerta_id uuid references public.alertas(id) on delete set null,
  add column if not exists salvo_alerta_em timestamptz;

