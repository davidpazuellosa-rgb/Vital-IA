-- Índice de texto dos documentos (acervo e documentos de clientes), para a Vita pesquisar o CONTEÚDO
-- sem reler os arquivos toda vez. Preenchido sob demanda; refeito se o arquivo mudar.
create table if not exists public.documentos_texto (
  origem text not null check (origem in ('documentos', 'cliente_documentos')),
  documento_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,   -- empresa (acervo) ou usuário (clientes)
  arquivo_path text not null,                                            -- para saber se o arquivo mudou
  texto text not null default '',
  caracteres integer not null default 0,
  observacao text,                                                       -- ex.: "PDF escaneado: OCR das 10 primeiras páginas"
  extraido_em timestamptz not null default now(),
  primary key (origem, documento_id)
);
create index if not exists documentos_texto_user_idx on public.documentos_texto (user_id);

alter table public.documentos_texto enable row level security;
drop policy if exists "Vê índice dos documentos" on public.documentos_texto;
create policy "Vê índice dos documentos" on public.documentos_texto for select
  using (user_id = public.empresa_user_id() or user_id = auth.uid());
drop policy if exists "Cria índice dos documentos" on public.documentos_texto;
create policy "Cria índice dos documentos" on public.documentos_texto for insert
  with check (user_id = public.empresa_user_id() or user_id = auth.uid());
drop policy if exists "Atualiza índice dos documentos" on public.documentos_texto;
create policy "Atualiza índice dos documentos" on public.documentos_texto for update
  using (user_id = public.empresa_user_id() or user_id = auth.uid());
drop policy if exists "Apaga índice dos documentos" on public.documentos_texto;
create policy "Apaga índice dos documentos" on public.documentos_texto for delete
  using (user_id = public.empresa_user_id() or user_id = auth.uid());
