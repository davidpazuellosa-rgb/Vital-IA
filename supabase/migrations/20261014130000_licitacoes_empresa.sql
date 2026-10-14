-- Cada licitação salva pertence a uma empresa (tag Vital Norte ou RM); cada pessoa só vê a(s) dela(s).
alter table public.saved_licitacoes
  add column if not exists empresa text not null default 'vital-norte'
  check (empresa in ('vital-norte', 'rm'));

alter table public.saved_licitacoes
  drop constraint if exists saved_licitacoes_user_id_numero_controle_pncp_plataforma_key;
alter table public.saved_licitacoes
  drop constraint if exists saved_licitacoes_user_empresa_numero_key;
alter table public.saved_licitacoes
  add constraint saved_licitacoes_user_empresa_numero_key
  unique (user_id, empresa, numero_controle_pncp, plataforma);

drop policy if exists "Acesso por empresa" on public.saved_licitacoes;
create policy "Acesso por empresa" on public.saved_licitacoes
  as restrictive for all using (public.pode_empresa(empresa));

-- Propostas acompanham a empresa da licitação (e não mais sempre a Vital Norte).
drop policy if exists "Acesso por empresa" on public.propostas;
create policy "Acesso por empresa" on public.propostas
  as restrictive for all using (
    exists (
      select 1 from public.saved_licitacoes s
      where s.id = propostas.licitacao_id and public.pode_empresa(s.empresa)
    )
  );

notify pgrst, 'reload schema';
