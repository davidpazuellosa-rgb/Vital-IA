-- Permite configurar o token do bot pela própria página de Alertas.
-- O token fica protegido por RLS junto da configuração do usuário.

alter table public.notificacoes_config
  add column if not exists telegram_bot_token text not null default '';
