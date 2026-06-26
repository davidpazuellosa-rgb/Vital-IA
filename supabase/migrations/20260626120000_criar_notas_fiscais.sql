-- Módulo de emissão de Nota Fiscal (NF-e modelo 55) — Vital Norte.
-- Cada nota pertence a um usuário e pode estar vinculada a um cliente/contratação.
-- O emitente vem da tabela public.empresa; o destinatário (órgão) é gravado aqui,
-- pois a NF-e exige documento e endereço que clientes não armazena.
create table if not exists public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  contratacao_id uuid references public.contratacoes (id) on delete set null,
  ref text not null,                                   -- referência idempotente enviada ao provedor
  natureza_operacao text not null default 'Venda de mercadoria',
  status text not null default 'rascunho',             -- rascunho | processando | autorizada | rejeitada | cancelada
  numero text not null default '',
  serie text not null default '',
  motivo_rejeicao text not null default '',
  valor_total numeric not null default 0,
  itens jsonb not null default '[]'::jsonb,
  observacoes text not null default '',
  -- destinatário (órgão público)
  destinatario_nome text not null default '',
  destinatario_documento text not null default '',     -- CNPJ (14) ou CPF (11), só dígitos
  destinatario_ie text not null default '',
  destinatario_cep text not null default '',
  destinatario_logradouro text not null default '',
  destinatario_numero text not null default '',
  destinatario_bairro text not null default '',
  destinatario_municipio text not null default '',
  destinatario_uf text not null default '',
  -- retorno do provedor/SEFAZ
  danfe_url text not null default '',
  xml_url text not null default '',
  payload jsonb,
  anexada_em timestamptz, -- marca idempotente do anexo na contratação
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, ref)
);

alter table public.notas_fiscais
  drop constraint if exists notas_fiscais_status_check;
alter table public.notas_fiscais
  add constraint notas_fiscais_status_check
  check (status in ('rascunho', 'processando', 'autorizada', 'rejeitada', 'cancelada'));

create index if not exists notas_fiscais_user_created_idx on public.notas_fiscais (user_id, created_at desc);
create index if not exists notas_fiscais_cliente_idx on public.notas_fiscais (cliente_id);

alter table public.notas_fiscais enable row level security;
drop policy if exists "Usuários veem suas notas fiscais" on public.notas_fiscais;
create policy "Usuários veem suas notas fiscais" on public.notas_fiscais
  for select using (auth.uid() = user_id);
drop policy if exists "Usuários inserem suas notas fiscais" on public.notas_fiscais;
create policy "Usuários inserem suas notas fiscais" on public.notas_fiscais
  for insert with check (auth.uid() = user_id);
drop policy if exists "Usuários atualizam suas notas fiscais" on public.notas_fiscais;
create policy "Usuários atualizam suas notas fiscais" on public.notas_fiscais
  for update using (auth.uid() = user_id);
drop policy if exists "Usuários removem suas notas fiscais" on public.notas_fiscais;
create policy "Usuários removem suas notas fiscais" on public.notas_fiscais
  for delete using (auth.uid() = user_id);
