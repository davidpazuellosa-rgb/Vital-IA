-- Controle dos lembretes "a proposta encerra em breve e ainda não foi enviada".
-- Um registro por licitação e limite (24h, 3h) evita repetir o mesmo aviso. Só a service role escreve.
create table if not exists public.lembretes_proposta (
  id uuid primary key default gen_random_uuid(),
  licitacao_id uuid not null references public.saved_licitacoes (id) on delete cascade,
  limite_horas int not null,
  enviado_em timestamptz not null default now(),
  unique (licitacao_id, limite_horas)
);

alter table public.lembretes_proposta enable row level security;
