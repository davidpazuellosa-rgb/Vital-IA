-- Mapa do sistema editável: assuntos próprios da empresa (somam ao mapa padrão do código) e
-- possibilidade de desligar assuntos do mapa padrão. Escopo de empresa.
create table if not exists public.vita_mapa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,        -- dono da empresa
  area text not null default 'Personalizado',
  assunto text not null check (char_length(assunto) between 3 and 120),
  palavras text[] not null default '{}',                                       -- como o usuário fala disso
  fontes jsonb not null default '[]'::jsonb,                                   -- [{tipo, ...}] (validado pelo app)
  dica text check (dica is null or char_length(dica) <= 300),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vita_mapa_user_idx on public.vita_mapa (user_id, created_at);

alter table public.vita_mapa enable row level security;
drop policy if exists "Empresa vê o mapa" on public.vita_mapa;
create policy "Empresa vê o mapa" on public.vita_mapa for select using (public.empresa_user_id() = user_id);
drop policy if exists "Empresa cria no mapa" on public.vita_mapa;
create policy "Empresa cria no mapa" on public.vita_mapa for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Empresa edita o mapa" on public.vita_mapa;
create policy "Empresa edita o mapa" on public.vita_mapa for update using (public.empresa_user_id() = user_id);
drop policy if exists "Empresa apaga do mapa" on public.vita_mapa;
create policy "Empresa apaga do mapa" on public.vita_mapa for delete using (public.empresa_user_id() = user_id);

alter table public.vita_configuracao add column if not exists mapa_desativados text[] not null default '{}';
