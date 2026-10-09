-- A busca por plataforma de origem passou a ser feita AO VIVO no PNCP (nada é copiado para o banco;
-- só o que a pessoa salva). A cópia (licitacoes_origem) e a rotina que a preenchia foram removidas.
drop table if exists public.licitacoes_origem;
