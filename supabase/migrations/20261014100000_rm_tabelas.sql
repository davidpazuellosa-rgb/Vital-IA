-- Empresa RM: tabelas PRÓPRIAS (espelho de documentos, empresa e catálogo), totalmente separadas da
-- Vital Norte. Mesmas colunas e mesma regra de acesso (escopo de empresa); nada do que já existe muda.
create table if not exists public.rm_documentos (like public.documentos including all);
create table if not exists public.rm_empresa (like public.empresa including all);
create table if not exists public.rm_catalogo_itens (like public.catalogo_itens including all);

-- LIKE não copia chaves estrangeiras
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rm_documentos_user_id_fkey') then
    alter table public.rm_documentos add constraint rm_documentos_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rm_empresa_user_id_fkey') then
    alter table public.rm_empresa add constraint rm_empresa_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rm_catalogo_itens_user_id_fkey') then
    alter table public.rm_catalogo_itens add constraint rm_catalogo_itens_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

alter table public.rm_documentos enable row level security;
alter table public.rm_empresa enable row level security;
alter table public.rm_catalogo_itens enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rm_documentos', 'rm_empresa', 'rm_catalogo_itens'] loop
    execute format('drop policy if exists "Empresa vê %1$s" on public.%1$s', t);
    execute format('create policy "Empresa vê %1$s" on public.%1$s for select using (public.empresa_user_id() = user_id)', t);
    execute format('drop policy if exists "Empresa cria %1$s" on public.%1$s', t);
    execute format('create policy "Empresa cria %1$s" on public.%1$s for insert with check (public.empresa_user_id() = user_id)', t);
    execute format('drop policy if exists "Empresa altera %1$s" on public.%1$s', t);
    execute format('create policy "Empresa altera %1$s" on public.%1$s for update using (public.empresa_user_id() = user_id)', t);
    execute format('drop policy if exists "Empresa apaga %1$s" on public.%1$s', t);
    execute format('create policy "Empresa apaga %1$s" on public.%1$s for delete using (public.empresa_user_id() = user_id)', t);
  end loop;
end $$;
