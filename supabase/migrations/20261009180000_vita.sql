-- Vita: assistente de IA. Conversas guardadas (pesquisáveis) e ações que esperam aprovação.
-- Tudo é pessoal: cada usuário vê só as próprias conversas e ações (RLS por auth.uid()).

create table if not exists public.vita_conversas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null default 'Nova conversa',
  -- licitações vistas nesta conversa (para a Vita salvar sem consultar o PNCP de novo)
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vita_conversas_user_idx on public.vita_conversas (user_id, updated_at desc);

create table if not exists public.vita_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.vita_conversas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  papel text not null check (papel in ('user', 'assistant', 'evento')),
  conteudo text not null default '',
  dados jsonb not null default '{}'::jsonb,   -- ferramentas usadas, ações propostas, protocolo do modelo
  created_at timestamptz not null default now()
);
create index if not exists vita_mensagens_conversa_idx on public.vita_mensagens (conversa_id, created_at);

create table if not exists public.vita_acoes (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.vita_conversas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,                          -- salvar_licitacao, remover_licitacao_salva…
  parametros jsonb not null default '{}'::jsonb,
  resumo text not null default '',
  detalhes jsonb not null default '[]'::jsonb, -- [{rotulo, valor}] exibidos no cartão
  aviso text,
  status text not null default 'pendente' check (status in ('pendente', 'executada', 'recusada', 'falhou')),
  resultado text,
  created_at timestamptz not null default now(),
  decidida_em timestamptz
);
create index if not exists vita_acoes_conversa_idx on public.vita_acoes (conversa_id, created_at);

alter table public.vita_conversas enable row level security;
alter table public.vita_mensagens enable row level security;
alter table public.vita_acoes enable row level security;

do $$
declare t text;
begin
  foreach t in array array['vita_conversas', 'vita_mensagens', 'vita_acoes'] loop
    execute format('drop policy if exists "Dono vê" on public.%I', t);
    execute format('create policy "Dono vê" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "Dono cria" on public.%I', t);
    execute format('create policy "Dono cria" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "Dono altera" on public.%I', t);
    execute format('create policy "Dono altera" on public.%I for update using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "Dono apaga" on public.%I', t);
    execute format('create policy "Dono apaga" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;
