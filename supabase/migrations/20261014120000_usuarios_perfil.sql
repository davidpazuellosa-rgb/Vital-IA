-- Cargos (super_admin / admin), acesso por empresa e convites por link.
create table if not exists public.usuarios_perfil (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  cargo text not null check (cargo in ('super_admin', 'admin')),
  empresas text[] not null default '{}' check (empresas <@ array['vital-norte', 'rm']::text[]),
  convite_hash text unique,
  convite_expira_em timestamptz,
  senha_definida_em timestamptz,
  bloqueado_em timestamptz,
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.usuarios_perfil add column if not exists bloqueado_em timestamptz;
alter table public.usuarios_perfil enable row level security;
drop policy if exists "Usuário vê o próprio perfil" on public.usuarios_perfil;
create policy "Usuário vê o próprio perfil" on public.usuarios_perfil
  for select using (auth.uid() = user_id);
-- Escrita só pelo servidor (service_role), depois de checar o cargo.

create or replace function public.meu_cargo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cargo from public.usuarios_perfil where user_id = auth.uid() and bloqueado_em is null;
$$;

create or replace function public.pode_empresa(slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select cargo = 'super_admin' or slug = any (empresas)
       from public.usuarios_perfil where user_id = auth.uid() and bloqueado_em is null),
    false
  );
$$;

revoke all on function public.meu_cargo() from public;
revoke all on function public.pode_empresa(text) from public;
grant execute on function public.meu_cargo() to authenticated, service_role;
grant execute on function public.pode_empresa(text) to authenticated, service_role;

-- Quem já existe continua com acesso total.
insert into public.usuarios_perfil (user_id, nome, cargo, empresas, senha_definida_em)
select u.id, '', 'super_admin', array['vital-norte', 'rm'], now()
from auth.users u
on conflict (user_id) do nothing;

-- Trava no banco: uma política RESTRITIVA por tabela (soma-se às que já existem).
do $$
declare t text;
begin
  foreach t in array array[
    'alertas', 'catalogo_itens', 'cliente_documentos', 'clientes', 'contratacoes', 'documentos',
    'documentos_texto', 'empresa', 'notas_fiscais', 'notificacoes_config', 'proposta_configuracao',
    'propostas', 'sistemas_licitacao'
  ] loop
    execute format('drop policy if exists "Acesso por empresa" on public.%I', t);
    execute format('create policy "Acesso por empresa" on public.%I as restrictive for all using (public.pode_empresa(%L))', t, 'vital-norte');
  end loop;
  foreach t in array array['rm_catalogo_itens', 'rm_documentos', 'rm_empresa'] loop
    execute format('drop policy if exists "Acesso por empresa" on public.%I', t);
    execute format('create policy "Acesso por empresa" on public.%I as restrictive for all using (public.pode_empresa(%L))', t, 'rm');
  end loop;
end $$;

notify pgrst, 'reload schema';
