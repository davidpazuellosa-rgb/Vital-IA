-- Dados cadastrais do órgão no cliente, reutilizados ao emitir NF-e.
-- Aditivo e idempotente.
alter table public.clientes add column if not exists cnpj text not null default '';
alter table public.clientes add column if not exists inscricao_estadual text not null default '';
alter table public.clientes add column if not exists cep text not null default '';
alter table public.clientes add column if not exists logradouro text not null default '';
alter table public.clientes add column if not exists numero text not null default '';
alter table public.clientes add column if not exists bairro text not null default '';
alter table public.clientes add column if not exists municipio text not null default '';
alter table public.clientes add column if not exists uf text not null default '';
