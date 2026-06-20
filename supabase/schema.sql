create table if not exists public.saved_licitacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  numero_controle_pncp text not null,
  plataforma text not null,
  titulo text not null,
  descricao text not null default '',
  orgao text not null default '',
  uf text not null default '',
  municipio text not null default '',
  modalidade text not null default '',
  situacao text not null default '',
  valor_estimado numeric,
  data_publicacao timestamptz,
  data_abertura_proposta timestamptz,
  data_encerramento_proposta timestamptz,
  link_origem text,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, numero_controle_pncp, plataforma)
);

alter table public.saved_licitacoes enable row level security;

create policy "Usuários veem apenas suas licitações salvas"
  on public.saved_licitacoes for select
  using (auth.uid() = user_id);

create policy "Usuários inserem suas próprias licitações"
  on public.saved_licitacoes for insert
  with check (auth.uid() = user_id);

create policy "Usuários atualizam suas próprias licitações"
  on public.saved_licitacoes for update
  using (auth.uid() = user_id);

create policy "Usuários removem suas próprias licitações"
  on public.saved_licitacoes for delete
  using (auth.uid() = user_id);
