-- Configuração de notificações por usuário, usada pelos alertas do Telegram.

create table if not exists public.notificacoes_config (
  user_id uuid primary key references auth.users (id) on delete cascade,
  telegram_chat_id text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.notificacoes_config enable row level security;

drop policy if exists "Usuários veem sua configuração de notificação" on public.notificacoes_config;
create policy "Usuários veem sua configuração de notificação"
  on public.notificacoes_config for select
  using (auth.uid() = user_id);

drop policy if exists "Usuários inserem sua configuração de notificação" on public.notificacoes_config;
create policy "Usuários inserem sua configuração de notificação"
  on public.notificacoes_config for insert
  with check (auth.uid() = user_id);

drop policy if exists "Usuários atualizam sua configuração de notificação" on public.notificacoes_config;
create policy "Usuários atualizam sua configuração de notificação"
  on public.notificacoes_config for update
  using (auth.uid() = user_id);
