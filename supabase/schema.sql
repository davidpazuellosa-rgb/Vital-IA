-- =====================================================================
-- Escopo da empresa (mais de um usuário pode operar o mesmo acervo)
-- =====================================================================
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
  etapa text not null default 'oportunidade',
  created_at timestamptz not null default now(),
  unique (user_id, numero_controle_pncp, plataforma)
);

-- Para bancos já existentes: adiciona a coluna de etapa do funil
alter table public.saved_licitacoes
  add column if not exists etapa text not null default 'oportunidade';

alter table public.saved_licitacoes
  alter column etapa set default 'oportunidade';

update public.saved_licitacoes
set etapa = case etapa
  when 'aberta' then 'oportunidade'
  when 'participando' then 'proposta_enviada'
  when 'recusada' then 'perdida'
  when 'concluida' then 'vencida'
  else coalesce(etapa, 'oportunidade')
end
where etapa is null
   or etapa in ('aberta', 'participando', 'recusada', 'concluida')
   or etapa not in ('oportunidade', 'proposta_pronta', 'proposta_enviada', 'vencida', 'perdida');

alter table public.saved_licitacoes
  drop constraint if exists saved_licitacoes_etapa_check;

alter table public.saved_licitacoes
  add constraint saved_licitacoes_etapa_check
  check (etapa in ('oportunidade', 'proposta_pronta', 'proposta_enviada', 'vencida', 'perdida'));

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

-- =====================================================================
-- Propostas (configuração-base e rascunho por licitação)
-- =====================================================================
create table if not exists public.proposta_configuracao (
  user_id uuid primary key references auth.users (id) on delete cascade,
  validade_dias integer not null default 60,
  impostos_inclusos boolean not null default true,
  representante_legal text not null default '',
  representante_cargo text not null default '',
  observacoes_padrao text not null default '',
  updated_at timestamptz not null default now()
);

-- Condições de entrega e pagamento pertencem a cada licitação, não à configuração global.
alter table public.proposta_configuracao drop column if exists prazo_entrega;
alter table public.proposta_configuracao drop column if exists condicoes_pagamento;

alter table public.proposta_configuracao enable row level security;
drop policy if exists "Usuários veem sua configuração de proposta" on public.proposta_configuracao;
create policy "Usuários veem sua configuração de proposta" on public.proposta_configuracao
  for select using (public.empresa_user_id() = user_id);
drop policy if exists "Usuários inserem sua configuração de proposta" on public.proposta_configuracao;
create policy "Usuários inserem sua configuração de proposta" on public.proposta_configuracao
  for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Usuários atualizam sua configuração de proposta" on public.proposta_configuracao;
create policy "Usuários atualizam sua configuração de proposta" on public.proposta_configuracao
  for update using (public.empresa_user_id() = user_id);

create table if not exists public.propostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  licitacao_id uuid not null references public.saved_licitacoes (id) on delete cascade,
  status text not null default 'rascunho',
  validade_dias integer not null default 60,
  prazo_entrega text not null default '',
  condicoes_pagamento text not null default '',
  observacoes text not null default '',
  itens jsonb not null default '[]'::jsonb,
  analise_edital jsonb,
  edital_analisado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, licitacao_id)
);

alter table public.propostas add column if not exists analise_edital jsonb;
alter table public.propostas add column if not exists edital_analisado_em timestamptz;

alter table public.propostas enable row level security;
drop policy if exists "Usuários veem suas propostas" on public.propostas;
create policy "Usuários veem suas propostas" on public.propostas
  for select using (auth.uid() = user_id);
drop policy if exists "Usuários inserem suas propostas" on public.propostas;
create policy "Usuários inserem suas propostas" on public.propostas
  for insert with check (auth.uid() = user_id);
drop policy if exists "Usuários atualizam suas propostas" on public.propostas;
create policy "Usuários atualizam suas propostas" on public.propostas
  for update using (auth.uid() = user_id);
drop policy if exists "Usuários removem suas propostas" on public.propostas;
create policy "Usuários removem suas propostas" on public.propostas
  for delete using (auth.uid() = user_id);

-- =====================================================================
-- Documentos (habilitação para gerar propostas)
-- =====================================================================
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null default 'avulso',        -- slug do checklist ou 'avulso'
  nome text not null,                          -- nome de exibição
  arquivo_path text not null,                  -- caminho no storage
  arquivo_nome text not null default '',       -- nome original do arquivo
  data_emissao date,
  data_validade date,                          -- usada para validar (nula = sem data)
  validade_automatica boolean not null default false, -- data veio da extração do PDF
  created_at timestamptz not null default now()
);

alter table public.documentos enable row level security;

drop policy if exists "Usuários veem apenas seus documentos" on public.documentos;
create policy "Usuários veem apenas seus documentos"
  on public.documentos for select
  using (public.empresa_user_id() = user_id);

drop policy if exists "Usuários inserem seus próprios documentos" on public.documentos;
create policy "Usuários inserem seus próprios documentos"
  on public.documentos for insert
  with check (public.empresa_user_id() = user_id);

drop policy if exists "Usuários atualizam seus próprios documentos" on public.documentos;
create policy "Usuários atualizam seus próprios documentos"
  on public.documentos for update
  using (public.empresa_user_id() = user_id);

drop policy if exists "Usuários removem seus próprios documentos" on public.documentos;
create policy "Usuários removem seus próprios documentos"
  on public.documentos for delete
  using (public.empresa_user_id() = user_id);

-- Bucket privado de armazenamento dos arquivos
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Políticas de storage: cada usuário só acessa arquivos sob seu próprio prefixo (user_id/...)
drop policy if exists "Usuários leem seus arquivos de documentos" on storage.objects;
create policy "Usuários leem seus arquivos de documentos"
  on storage.objects for select
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = public.empresa_user_id()::text);

drop policy if exists "Usuários enviam seus arquivos de documentos" on storage.objects;
create policy "Usuários enviam seus arquivos de documentos"
  on storage.objects for insert
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = public.empresa_user_id()::text);

drop policy if exists "Usuários removem seus arquivos de documentos" on storage.objects;
create policy "Usuários removem seus arquivos de documentos"
  on storage.objects for delete
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = public.empresa_user_id()::text);
create table if not exists public.empresa (
  user_id uuid primary key references auth.users (id) on delete cascade,
  razao_social text not null default '',
  nome_fantasia text not null default '',
  cnpj text not null default '',
  porte text not null default '',
  natureza_juridica text not null default '',
  data_abertura date,
  cnae_principal text not null default '',
  inscricao_estadual text not null default '',
  inscricao_municipal text not null default '',
  email text not null default '',
  telefone text not null default '',
  cep text not null default '',
  logradouro text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  municipio text not null default '',
  uf text not null default '',
  dados_bancarios text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.empresa enable row level security;

drop policy if exists "Usuários veem seus dados de empresa" on public.empresa;
create policy "Usuários veem seus dados de empresa" on public.empresa for select using (public.empresa_user_id() = user_id);
drop policy if exists "Usuários inserem seus dados de empresa" on public.empresa;
create policy "Usuários inserem seus dados de empresa" on public.empresa for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Usuários atualizam seus dados de empresa" on public.empresa;
create policy "Usuários atualizam seus dados de empresa" on public.empresa for update using (public.empresa_user_id() = user_id);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  orgao text not null default '',
  observacoes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.clientes enable row level security;
drop policy if exists "Usuários veem seus clientes" on public.clientes;
create policy "Usuários veem seus clientes" on public.clientes for select using (auth.uid() = user_id);
drop policy if exists "Usuários inserem seus clientes" on public.clientes;
create policy "Usuários inserem seus clientes" on public.clientes for insert with check (auth.uid() = user_id);
drop policy if exists "Usuários atualizam seus clientes" on public.clientes;
create policy "Usuários atualizam seus clientes" on public.clientes for update using (auth.uid() = user_id);
drop policy if exists "Usuários removem seus clientes" on public.clientes;
create policy "Usuários removem seus clientes" on public.clientes for delete using (auth.uid() = user_id);

create table if not exists public.cliente_documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null default 'avulso',
  nome text not null,
  arquivo_path text not null,
  arquivo_nome text not null default '',
  created_at timestamptz not null default now()
);

alter table public.cliente_documentos enable row level security;
drop policy if exists "Usuários veem seus docs de cliente" on public.cliente_documentos;
create policy "Usuários veem seus docs de cliente" on public.cliente_documentos for select using (auth.uid() = user_id);
drop policy if exists "Usuários inserem seus docs de cliente" on public.cliente_documentos;
create policy "Usuários inserem seus docs de cliente" on public.cliente_documentos for insert with check (auth.uid() = user_id);
drop policy if exists "Usuários removem seus docs de cliente" on public.cliente_documentos;
create policy "Usuários removem seus docs de cliente" on public.cliente_documentos for delete using (auth.uid() = user_id);


-- Status e próximo passo por cliente
alter table public.clientes add column if not exists status text not null default '';
alter table public.clientes add column if not exists proximo_passo text not null default '';

-- Contratações (cada cliente pode ter várias licitações/contratos)
create table if not exists public.contratacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  identificador text not null default '',
  status text not null default '',
  proximo_passo text not null default '',
  created_at timestamptz not null default now()
);
alter table public.contratacoes enable row level security;
create policy "Usuários veem suas contratações" on public.contratacoes for select using (auth.uid() = user_id);
create policy "Usuários inserem suas contratações" on public.contratacoes for insert with check (auth.uid() = user_id);
create policy "Usuários atualizam suas contratações" on public.contratacoes for update using (auth.uid() = user_id);
create policy "Usuários removem suas contratações" on public.contratacoes for delete using (auth.uid() = user_id);

alter table public.cliente_documentos add column if not exists contratacao_id uuid references public.contratacoes (id) on delete cascade;

-- Alertas (buscas automáticas de licitações + dedupe de envios)
create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  keyword text not null default '',
  ufs text[] not null default '{}',
  modalidades integer[] not null default '{}',
  valor_min numeric,
  valor_max numeric,
  apenas_aberto boolean not null default true,
  ativo boolean not null default true,
  ultima_execucao timestamptz,
  created_at timestamptz not null default now()
);
alter table public.alertas enable row level security;
create policy "Usuários veem seus alertas" on public.alertas for select using (auth.uid() = user_id);
create policy "Usuários inserem seus alertas" on public.alertas for insert with check (auth.uid() = user_id);
create policy "Usuários atualizam seus alertas" on public.alertas for update using (auth.uid() = user_id);
create policy "Usuários removem seus alertas" on public.alertas for delete using (auth.uid() = user_id);

create table if not exists public.alerta_envios (
  alerta_id uuid not null references public.alertas (id) on delete cascade,
  numero_controle_pncp text not null,
  enviado_em timestamptz not null default now(),
  primary key (alerta_id, numero_controle_pncp)
);
alter table public.alerta_envios enable row level security;

create table if not exists public.notificacoes_config (
  user_id uuid primary key references auth.users (id) on delete cascade,
  telegram_chat_id text not null default '',
  telegram_bot_token text not null default '',
  email_destino text not null default '',
  email_remetente text not null default '',
  email_api_key text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.notificacoes_config
  add column if not exists telegram_bot_token text not null default '';
alter table public.notificacoes_config
  add column if not exists email_destino text not null default '';
alter table public.notificacoes_config
  add column if not exists email_remetente text not null default '';
alter table public.notificacoes_config
  add column if not exists email_api_key text not null default '';
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

-- =====================================================================
-- Notas Fiscais (emissão de NF-e via provedor REST)
-- =====================================================================
create table if not exists public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  contratacao_id uuid references public.contratacoes (id) on delete set null,
  ref text not null,
  natureza_operacao text not null default 'Venda de mercadoria',
  status text not null default 'rascunho',
  numero text not null default '',
  serie text not null default '',
  motivo_rejeicao text not null default '',
  valor_total numeric not null default 0,
  itens jsonb not null default '[]'::jsonb,
  observacoes text not null default '',
  destinatario_nome text not null default '',
  destinatario_documento text not null default '',
  destinatario_ie text not null default '',
  destinatario_cep text not null default '',
  destinatario_logradouro text not null default '',
  destinatario_numero text not null default '',
  destinatario_bairro text not null default '',
  destinatario_municipio text not null default '',
  destinatario_uf text not null default '',
  danfe_url text not null default '',
  xml_url text not null default '',
  payload jsonb,
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
