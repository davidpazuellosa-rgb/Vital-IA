-- Sistemas de Licitação deixa de ser exclusivo da Vital Norte: qualquer usuário ativo (com perfil, não bloqueado) enxerga a página.
-- Os dados continuam da empresa dona (políticas de empresa); só a trava "por empresa" muda.
drop policy if exists "Acesso por empresa" on public.sistemas_licitacao;
create policy "Acesso por empresa" on public.sistemas_licitacao as restrictive for all
  using (public.meu_cargo() is not null);
