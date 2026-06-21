-- Alertas automáticos de licitações e deduplicação de envios.

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  keyword text not null default '',
  ufs text[] not null default '{}',
  modalidades integer[] not null default '{}',
  valor_min numeric,
  valor_max numeric,
  apenas_aberto boolean not null default true,
  ativo boolean not null default true,
  ultima_execucao timestamptz,
  created_at timestamptz not null default now()
);

alter table public.alertas enable row level security;

drop policy if exists "Usuários veem seus alertas" on public.alertas;
create policy "Usuários veem seus alertas"
  on public.alertas for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários inserem seus alertas" on public.alertas;
create policy "Usuários inserem seus alertas"
  on public.alertas for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários atualizam seus alertas" on public.alertas;
create policy "Usuários atualizam seus alertas"
  on public.alertas for update
  using (auth.uid() = user_id);

drop policy if exists "Usuários removem seus alertas" on public.alertas;
create policy "Usuários removem seus alertas"
  on public.alertas for delete
  using (auth.uid() = user_id);

create table if not exists public.alerta_envios (
  alerta_id uuid not null references public.alertas (id) on delete cascade,
  numero_controle_pncp text not null,
  enviado_em timestamptz not null default now(),
  primary key (alerta_id, numero_controle_pncp)
);

alter table public.alerta_envios enable row level security;
