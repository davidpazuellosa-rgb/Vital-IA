-- Padroniza a nomenclatura nova do pipeline de licitações.
-- Valores antigos:
--   aberta        -> oportunidade
--   participando  -> proposta_enviada
--   recusada      -> perdida
--   concluida     -> vencida

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
