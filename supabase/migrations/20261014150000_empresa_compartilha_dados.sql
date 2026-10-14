-- Quem tem acesso à empresa vê TUDO dela: licitações, clientes, contratações, documentos de clientes,
-- notas fiscais e propostas passam a pertencer à empresa (dono = empresa_user_id()), não a quem criou.
-- Um gatilho grava o dono certo em todo insert feito por uma pessoa logada.

create or replace function public.mesma_empresa(dono uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.empresa_user_id() = coalesce((select m.empresa_user_id from public.empresa_membros m where m.user_id = dono), dono);
$$;

create or replace function public.pasta_da_empresa(pasta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select pasta = public.empresa_user_id()::text
      or exists (select 1 from public.empresa_membros m
                 where m.user_id::text = pasta and m.empresa_user_id = public.empresa_user_id());
$$;

create or replace function public.atribuir_empresa_dona()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.user_id := public.empresa_user_id();
  end if;
  return new;
end;
$$;

revoke all on function public.mesma_empresa(uuid), public.pasta_da_empresa(text) from public;
grant execute on function public.mesma_empresa(uuid), public.pasta_da_empresa(text) to authenticated, service_role;

do $$
declare t text; p record;
begin
  foreach t in array array['saved_licitacoes', 'clientes', 'contratacoes', 'cliente_documentos', 'notas_fiscais', 'propostas'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t and permissive = 'PERMISSIVE' loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    -- o que já existe passa para o dono da empresa
    execute format('update public.%I x set user_id = m.empresa_user_id from public.empresa_membros m where m.user_id = x.user_id and m.empresa_user_id <> m.user_id', t);
    execute format('drop trigger if exists atribuir_empresa_dona on public.%I', t);
    execute format('create trigger atribuir_empresa_dona before insert on public.%I for each row execute function public.atribuir_empresa_dona()', t);
    execute format('create policy "Empresa vê" on public.%I for select using (user_id = public.empresa_user_id())', t);
    execute format('create policy "Empresa insere" on public.%I for insert with check (user_id = public.empresa_user_id())', t);
    execute format('create policy "Empresa atualiza" on public.%I for update using (user_id = public.empresa_user_id())', t);
    execute format('create policy "Empresa remove" on public.%I for delete using (user_id = public.empresa_user_id())', t);
  end loop;
end $$;

-- Alertas: toda a empresa vê e edita; quem criou continua sendo quem recebe os avisos (user_id não muda).
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'alertas' and permissive = 'PERMISSIVE' loop
    execute format('drop policy %I on public.alertas', p.policyname);
  end loop;
end $$;
create policy "Empresa vê alertas" on public.alertas for select using (public.mesma_empresa(user_id));
create policy "Cria o próprio alerta" on public.alertas for insert with check (auth.uid() = user_id);
create policy "Empresa atualiza alertas" on public.alertas for update using (public.mesma_empresa(user_id));
create policy "Empresa remove alertas" on public.alertas for delete using (public.mesma_empresa(user_id));

-- Arquivos: a empresa lê o que qualquer pessoa dela enviou (pasta do dono ou de um membro), exceto as
-- configurações de notificação (chaves), que só o servidor acessa.
drop policy if exists "Usuários leem seus arquivos de documentos" on storage.objects;
drop policy if exists "Usuários enviam seus arquivos de documentos" on storage.objects;
drop policy if exists "Usuários removem seus arquivos de documentos" on storage.objects;
create policy "Empresa lê arquivos de documentos" on storage.objects for select
  using (bucket_id = 'documentos' and public.pasta_da_empresa((storage.foldername(name))[1])
         and (storage.foldername(name))[2] is distinct from 'notificacoes');
create policy "Empresa envia arquivos de documentos" on storage.objects for insert
  with check (bucket_id = 'documentos' and public.pasta_da_empresa((storage.foldername(name))[1])
              and (storage.foldername(name))[2] is distinct from 'notificacoes');
create policy "Empresa remove arquivos de documentos" on storage.objects for delete
  using (bucket_id = 'documentos' and public.pasta_da_empresa((storage.foldername(name))[1])
         and (storage.foldername(name))[2] is distinct from 'notificacoes');

notify pgrst, 'reload schema';
