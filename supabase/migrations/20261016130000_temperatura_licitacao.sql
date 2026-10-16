-- Temperatura da licitação salva: fria, morna ou quente (nula = ainda sem classificação).
alter table public.saved_licitacoes
  add column if not exists temperatura text
  check (temperatura in ('fria', 'morna', 'quente'));
