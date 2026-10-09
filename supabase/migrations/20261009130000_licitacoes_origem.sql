-- Índice próprio das licitações abertas por SISTEMA DE ORIGEM (ex.: Licitar Digital).
-- O PNCP não filtra por sistema de origem: a rotina scripts/indexar-origem.mjs varre as
-- licitações abertas e guarda aqui as que acontecem nos sistemas listados em
-- src/lib/licitacoes/origens.json. Dado público do PNCP — escrita só pela service role.
create table if not exists public.licitacoes_origem (
  numero_controle_pncp text primary key,
  origem text not null,                       -- id da plataforma (ex.: licitar-digital)
  titulo text not null default '',
  descricao text not null default '',
  orgao text not null default '',
  orgao_cnpj text not null default '',
  esfera text not null default '',
  uf text not null default '',
  municipio text not null default '',
  modalidade text not null default '',
  modalidade_id int,
  situacao text not null default '',
  valor_estimado numeric,
  data_publicacao timestamptz,
  data_abertura_proposta timestamptz,
  data_encerramento_proposta timestamptz,
  link_origem text,
  busca text not null default '',             -- descrição + órgão + município, sem acento, minúsculo
  orgao_busca text not null default '',       -- órgão sem acento, minúsculo
  atualizado_em timestamptz not null default now()
);

create index if not exists licitacoes_origem_origem_pub_idx on public.licitacoes_origem (origem, data_publicacao desc);
create index if not exists licitacoes_origem_encerramento_idx on public.licitacoes_origem (data_encerramento_proposta);

alter table public.licitacoes_origem enable row level security;
drop policy if exists "Usuários logados leem o índice por origem" on public.licitacoes_origem;
create policy "Usuários logados leem o índice por origem" on public.licitacoes_origem
  for select to authenticated using (true);
