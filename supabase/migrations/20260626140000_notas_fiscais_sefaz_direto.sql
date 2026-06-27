-- Suporte à emissão direta com a SEFAZ (NFE_ENGINE=sefaz).
-- Aditiva e idempotente — não altera o fluxo Focus existente.

-- Campos que a integração direta precisa guardar na nota.
alter table public.notas_fiscais
  add column if not exists destinatario_codigo_municipio text not null default '', -- IBGE 7 díg. (cMun)
  add column if not exists chave text not null default '',      -- chave de acesso (44 díg.)
  add column if not exists protocolo text not null default '';  -- protocolo de autorização (p/ cancelamento)

-- Numeração sequencial sem buracos, por série (responsabilidade do emitente).
create table if not exists public.nfe_numeracao (
  serie integer primary key,
  proximo_numero integer not null default 1,
  atualizado_em timestamptz not null default now()
);

-- RLS habilitado SEM políticas: nenhum cliente (anon/authenticated) acessa a
-- tabela diretamente. Só a função proximo_numero_nfe() a toca, e ela é
-- SECURITY DEFINER (passa por cima do RLS). É o comportamento desejado.
alter table public.nfe_numeracao enable row level security;

-- Aloca e devolve o próximo nNF de forma atômica (evita corrida/duplicidade).
-- SECURITY DEFINER: a numeração é da empresa, não por usuário.
create or replace function public.proximo_numero_nfe(p_serie integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero integer;
begin
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

grant execute on function public.proximo_numero_nfe(integer) to authenticated;
