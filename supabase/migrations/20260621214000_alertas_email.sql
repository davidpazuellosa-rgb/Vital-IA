alter table public.notificacoes_config
  add column if not exists email_destino text not null default '',
  add column if not exists email_remetente text not null default '',
  add column if not exists email_api_key text not null default '';
