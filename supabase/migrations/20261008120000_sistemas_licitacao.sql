-- Sistemas/portais de licitação em que a empresa tem cadastro (atalhos de acesso).
-- Escopo de empresa: todos os membros veem e editam a mesma lista.
-- Senhas NÃO são guardadas aqui — ficam no gerenciador de senhas do navegador.
create table if not exists public.sistemas_licitacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  url text not null,
  login text not null default '',        -- usuário/CPF/CNPJ de acesso (sem senha)
  observacoes text not null default '',
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists sistemas_licitacao_user_ordem_idx on public.sistemas_licitacao (user_id, ordem);

alter table public.sistemas_licitacao enable row level security;

drop policy if exists "Empresa vê seus sistemas de licitação" on public.sistemas_licitacao;
create policy "Empresa vê seus sistemas de licitação" on public.sistemas_licitacao
  for select using (public.empresa_user_id() = user_id);
drop policy if exists "Empresa cadastra sistemas de licitação" on public.sistemas_licitacao;
create policy "Empresa cadastra sistemas de licitação" on public.sistemas_licitacao
  for insert with check (public.empresa_user_id() = user_id);
drop policy if exists "Empresa edita sistemas de licitação" on public.sistemas_licitacao;
create policy "Empresa edita sistemas de licitação" on public.sistemas_licitacao
  for update using (public.empresa_user_id() = user_id);
drop policy if exists "Empresa remove sistemas de licitação" on public.sistemas_licitacao;
create policy "Empresa remove sistemas de licitação" on public.sistemas_licitacao
  for delete using (public.empresa_user_id() = user_id);

-- Sistemas iniciais para cada empresa que ainda não tem nenhum cadastrado.
insert into public.sistemas_licitacao (user_id, nome, url, observacoes, ordem)
select e.user_id, s.nome, s.url, s.observacoes, s.ordem
from public.empresa e
cross join (values
  ('BLL Compras',     'https://bllcompras.com/Home/Login',                                  '', 1),
  ('Licitar Digital', 'https://licitardigital.com.br',                                      '', 2),
  ('Compras.gov.br',  'https://www.comprasnet.gov.br/seguro/loginPortalFornecedor.asp',     'Acesso do fornecedor com conta gov.br (ou certificado digital).', 3),
  ('Licitanet',       'https://licitanet.com.br',                                           '', 4),
  ('e-Compras AM',    'https://www.e-compras.am.gov.br',                                    '', 5),
  ('Compras Manaus',  'https://compras.manaus.am.gov.br',                                   '', 6)
) as s(nome, url, observacoes, ordem)
where not exists (select 1 from public.sistemas_licitacao x where x.user_id = e.user_id);
