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
  etapa text not null default 'aberta',
  created_at timestamptz not null default now(),
  unique (user_id, numero_controle_pncp, plataforma)
);

-- Para bancos já existentes: adiciona a coluna de etapa do funil
alter table public.saved_licitacoes
  add column if not exists etapa text not null default 'aberta';

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

create policy "Usuários veem apenas seus documentos"
  on public.documentos for select
  using (auth.uid() = user_id);

create policy "Usuários inserem seus próprios documentos"
  on public.documentos for insert
  with check (auth.uid() = user_id);

create policy "Usuários atualizam seus próprios documentos"
  on public.documentos for update
  using (auth.uid() = user_id);

create policy "Usuários removem seus próprios documentos"
  on public.documentos for delete
  using (auth.uid() = user_id);

-- Bucket privado de armazenamento dos arquivos
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Políticas de storage: cada usuário só acessa arquivos sob seu próprio prefixo (user_id/...)
create policy "Usuários leem seus arquivos de documentos"
  on storage.objects for select
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Usuários enviam seus arquivos de documentos"
  on storage.objects for insert
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Usuários removem seus arquivos de documentos"
  on storage.objects for delete
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
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
create policy "Usuários veem seus dados de empresa" on public.empresa for select using (auth.uid() = user_id);
drop policy if exists "Usuários inserem seus dados de empresa" on public.empresa;
create policy "Usuários inserem seus dados de empresa" on public.empresa for insert with check (auth.uid() = user_id);
drop policy if exists "Usuários atualizam seus dados de empresa" on public.empresa;
create policy "Usuários atualizam seus dados de empresa" on public.empresa for update using (auth.uid() = user_id);

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
