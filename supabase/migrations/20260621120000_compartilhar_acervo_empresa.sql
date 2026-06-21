-- Permite que usuários da mesma empresa operem o mesmo acervo documental.
create table if not exists public.empresa_membros (
  user_id uuid primary key references auth.users (id) on delete cascade,
  empresa_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.empresa_membros enable row level security;
drop policy if exists "Usuários veem seu vínculo de empresa" on public.empresa_membros;
create policy "Usuários veem seu vínculo de empresa" on public.empresa_membros
  for select using (auth.uid() = user_id);

create or replace function public.empresa_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select empresa_user_id from public.empresa_membros where user_id = auth.uid()),
    auth.uid()
  );
$$;

revoke all on function public.empresa_user_id() from public;
grant execute on function public.empresa_user_id() to authenticated;

drop policy if exists "Usuários veem sua configuração de proposta" on public.proposta_configuracao;
create policy "Usuários veem sua configuração de proposta" on public.proposta_configuracao
  for select using (public.empresa_user_id() = user_id);
drop policy if exists "Usuários inserem sua configuração de proposta" on public.proposta_configuracao;
create policy "Usuários inserem sua configuração de proposta" on public.proposta_configuracao
  for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Usuários atualizam sua configuração de proposta" on public.proposta_configuracao;
create policy "Usuários atualizam sua configuração de proposta" on public.proposta_configuracao
  for update using (public.empresa_user_id() = user_id);

drop policy if exists "Usuários veem apenas seus documentos" on public.documentos;
create policy "Usuários veem apenas seus documentos" on public.documentos
  for select using (public.empresa_user_id() = user_id);
drop policy if exists "Usuários inserem seus próprios documentos" on public.documentos;
create policy "Usuários inserem seus próprios documentos" on public.documentos
  for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Usuários atualizam seus próprios documentos" on public.documentos;
create policy "Usuários atualizam seus próprios documentos" on public.documentos
  for update using (public.empresa_user_id() = user_id);
drop policy if exists "Usuários removem seus próprios documentos" on public.documentos;
create policy "Usuários removem seus próprios documentos" on public.documentos
  for delete using (public.empresa_user_id() = user_id);

drop policy if exists "Usuários leem seus arquivos de documentos" on storage.objects;
create policy "Usuários leem seus arquivos de documentos" on storage.objects
  for select using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = public.empresa_user_id()::text
  );
drop policy if exists "Usuários enviam seus arquivos de documentos" on storage.objects;
create policy "Usuários enviam seus arquivos de documentos" on storage.objects
  for insert with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = public.empresa_user_id()::text
  );
drop policy if exists "Usuários removem seus arquivos de documentos" on storage.objects;
create policy "Usuários removem seus arquivos de documentos" on storage.objects
  for delete using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = public.empresa_user_id()::text
  );

drop policy if exists "Usuários veem seus dados de empresa" on public.empresa;
create policy "Usuários veem seus dados de empresa" on public.empresa
  for select using (public.empresa_user_id() = user_id);
drop policy if exists "Usuários inserem seus dados de empresa" on public.empresa;
create policy "Usuários inserem seus dados de empresa" on public.empresa
  for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Usuários atualizam seus dados de empresa" on public.empresa;
create policy "Usuários atualizam seus dados de empresa" on public.empresa
  for update using (public.empresa_user_id() = user_id);

-- Os dois acessos atuais pertencem à Vital Norte e compartilham o acervo já cadastrado.
insert into public.empresa_membros (user_id, empresa_user_id)
select vinculo.user_id, vinculo.empresa_user_id
from (values
  ('6d2d09fb-b603-44cc-b2a5-0046fd7f1c56'::uuid, '6d2d09fb-b603-44cc-b2a5-0046fd7f1c56'::uuid),
  ('739cc247-a3ce-4ead-b61f-86f913f04092'::uuid, '6d2d09fb-b603-44cc-b2a5-0046fd7f1c56'::uuid)
) as vinculo(user_id, empresa_user_id)
join auth.users usuario on usuario.id = vinculo.user_id
join auth.users empresa on empresa.id = vinculo.empresa_user_id
on conflict (user_id) do update
set empresa_user_id = excluded.empresa_user_id;
