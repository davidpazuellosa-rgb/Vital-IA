-- Controle do envio da proposta nas plataformas (a decisão e o clique de enviar continuam humanos).
-- status da proposta: 'rascunho' → 'enviada'. Comprovante fica no bucket privado "documentos".
alter table public.propostas
  add column if not exists plataforma_envio text not null default '',
  add column if not exists enviada_em timestamptz,
  add column if not exists protocolo_envio text not null default '',
  add column if not exists valor_enviado numeric,
  add column if not exists observacoes_envio text not null default '',
  add column if not exists comprovante_path text,
  add column if not exists comprovante_nome text;

create index if not exists propostas_status_idx on public.propostas (user_id, status);
