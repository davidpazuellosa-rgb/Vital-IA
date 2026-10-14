-- A Vita passa a ler e pesquisar o conteúdo dos documentos da RM: o índice aceita a origem rm_documentos
-- e a trava por empresa olha de qual empresa é cada linha.
alter table public.documentos_texto drop constraint if exists documentos_texto_origem_check;
alter table public.documentos_texto
  add constraint documentos_texto_origem_check
  check (origem in ('documentos', 'cliente_documentos', 'rm_documentos'));

drop policy if exists "Acesso por empresa" on public.documentos_texto;
create policy "Acesso por empresa" on public.documentos_texto
  as restrictive for all using (
    public.pode_empresa(case when origem = 'rm_documentos' then 'rm' else 'vital-norte' end)
  );

-- Pedido do usuário: o item Checkai (já no catálogo da Vital Norte) também no catálogo da RM. Cópia, sem tocar no original.
insert into public.rm_catalogo_itens
select c.* from public.catalogo_itens c
where c.id = 'd2bc79e3-119d-499a-86b7-be5c100745cd'
  and not exists (select 1 from public.rm_catalogo_itens r where r.nome = c.nome);

notify pgrst, 'reload schema';
