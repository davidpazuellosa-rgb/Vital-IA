-- Endurecimento (auditoria de segurança 2026-10-16).
-- 1) Visitante sem login (papel anon) não precisa de nada nas tabelas nem nas funções do sistema:
--    o app só fala com o banco como usuário logado (authenticated) ou pelo servidor (service_role).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role supabase_admin in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role supabase_admin in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role supabase_admin in schema public revoke execute on functions from anon;

-- 2) Usuário logado também não precisa de TRUNCATE/REFERENCES/TRIGGER (TRUNCATE ignora as regras de linha).
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
alter default privileges for role supabase_admin in schema public revoke truncate, references, trigger on tables from authenticated;

-- 3) Numeração da NF-e: só quem tem acesso à Vital Norte pode pedir um número (antes qualquer visitante podia).
create or replace function public.proximo_numero_nfe(p_serie integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero integer;
begin
  if auth.uid() is null or not public.pode_empresa('vital-norte') then
    raise exception 'Sem permissão para numerar notas fiscais.' using errcode = '42501';
  end if;
  if p_serie is null or p_serie < 1 or p_serie > 999 then
    raise exception 'Série inválida.' using errcode = '22023';
  end if;

  insert into public.nfe_numeracao (serie, proximo_numero)
    values (p_serie, 1)
  on conflict (serie) do nothing;

  update public.nfe_numeracao
     set proximo_numero = proximo_numero + 1,
         atualizado_em = now()
   where serie = p_serie
  returning proximo_numero - 1 into v_numero;

  return v_numero;
end;
$$;
revoke all on function public.proximo_numero_nfe(integer) from public, anon;
grant execute on function public.proximo_numero_nfe(integer) to authenticated, service_role;

-- as funções de apoio das regras continuam valendo para quem está logado e para o servidor
grant execute on function public.empresa_user_id(), public.mesma_empresa(uuid), public.meu_cargo(),
  public.pasta_da_empresa(text), public.pode_empresa(text) to authenticated, service_role;

notify pgrst, 'reload schema';
