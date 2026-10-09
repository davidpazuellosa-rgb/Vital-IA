-- Memória geral da Vita + configuração (ferramentas ligadas/desligadas). Escopo de empresa:
-- todos os membros veem e editam (mesma regra do catálogo).
create table if not exists public.vita_memorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,        -- dono da empresa
  conteudo text not null check (char_length(conteudo) between 3 and 600),
  categoria text not null default 'geral'
    check (categoria in ('geral', 'empresa', 'preferencia', 'processo', 'clientes', 'regra')),
  origem text not null default 'vita' check (origem in ('vita', 'usuario')),  -- quem criou
  ativo boolean not null default true,                                         -- desligada = a Vita não usa
  conversa_id uuid references public.vita_conversas (id) on delete set null,   -- conversa em que nasceu
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vita_memorias_user_idx on public.vita_memorias (user_id, created_at desc);

create table if not exists public.vita_configuracao (
  user_id uuid primary key references auth.users (id) on delete cascade,     -- dono da empresa
  memoria_ativa boolean not null default true,
  memoria_automatica boolean not null default true,                            -- false: só memoriza quando pedirem
  ferramentas_desativadas text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.vita_memorias enable row level security;
alter table public.vita_configuracao enable row level security;

drop policy if exists "Empresa vê memórias" on public.vita_memorias;
create policy "Empresa vê memórias" on public.vita_memorias for select using (public.empresa_user_id() = user_id);
drop policy if exists "Empresa cria memórias" on public.vita_memorias;
create policy "Empresa cria memórias" on public.vita_memorias for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Empresa edita memórias" on public.vita_memorias;
create policy "Empresa edita memórias" on public.vita_memorias for update using (public.empresa_user_id() = user_id);
drop policy if exists "Empresa apaga memórias" on public.vita_memorias;
create policy "Empresa apaga memórias" on public.vita_memorias for delete using (public.empresa_user_id() = user_id);

drop policy if exists "Empresa vê config da Vita" on public.vita_configuracao;
create policy "Empresa vê config da Vita" on public.vita_configuracao for select using (public.empresa_user_id() = user_id);
drop policy if exists "Empresa cria config da Vita" on public.vita_configuracao;
create policy "Empresa cria config da Vita" on public.vita_configuracao for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Empresa edita config da Vita" on public.vita_configuracao;
create policy "Empresa edita config da Vita" on public.vita_configuracao for update using (public.empresa_user_id() = user_id);
