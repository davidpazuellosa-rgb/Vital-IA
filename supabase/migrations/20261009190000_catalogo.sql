-- Catálogo de produtos e serviços da empresa (base para a Vita conversar sobre o que a empresa
-- vende, casar itens de edital e sugerir preço). Escopo de empresa: todos os membros veem e editam.
create table if not exists public.catalogo_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,   -- dono da empresa
  tipo text not null default 'produto' check (tipo in ('produto', 'servico')),
  nome text not null,
  descricao text not null default '',
  categoria text not null default '',
  unidade text not null default '',            -- UN, CX, KG, PCT, HORA, MÊS…
  marca text not null default '',
  codigo text not null default '',             -- CATMAT/CATSER/NCM, opcional
  custo numeric,                               -- custo unitário
  preco_referencia numeric,                    -- preço de venda de referência
  margem_minima numeric,                       -- % mínima aceitável
  fornecedores text not null default '',
  observacoes text not null default '',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalogo_itens_user_nome_idx on public.catalogo_itens (user_id, nome);

alter table public.catalogo_itens enable row level security;
drop policy if exists "Empresa vê o catálogo" on public.catalogo_itens;
create policy "Empresa vê o catálogo" on public.catalogo_itens
  for select using (public.empresa_user_id() = user_id);
drop policy if exists "Empresa cadastra no catálogo" on public.catalogo_itens;
create policy "Empresa cadastra no catálogo" on public.catalogo_itens
  for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Empresa edita o catálogo" on public.catalogo_itens;
create policy "Empresa edita o catálogo" on public.catalogo_itens
  for update using (public.empresa_user_id() = user_id);
drop policy if exists "Empresa remove do catálogo" on public.catalogo_itens;
create policy "Empresa remove do catálogo" on public.catalogo_itens
  for delete using (public.empresa_user_id() = user_id);
