-- Avaliações (👍/👎) das respostas da Vita, para ela aprender o que agrada. Escopo de empresa.
create table if not exists public.vita_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,        -- dono da empresa
  autor_id uuid not null references auth.users (id) on delete cascade,       -- quem avaliou
  mensagem_id uuid not null references public.vita_mensagens (id) on delete cascade,
  conversa_id uuid references public.vita_conversas (id) on delete cascade,
  nota smallint not null check (nota in (-1, 1)),                             -- 1 = gostei, -1 = não gostei
  motivo text check (motivo is null or char_length(motivo) <= 200),
  pedido text not null default '',                                            -- resumo do que o usuário pediu
  resposta text not null default '',                                          -- resumo da resposta avaliada
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mensagem_id, autor_id)
);
create index if not exists vita_feedback_user_idx on public.vita_feedback (user_id, created_at desc);
create index if not exists vita_feedback_conversa_idx on public.vita_feedback (conversa_id);

alter table public.vita_feedback enable row level security;
drop policy if exists "Empresa vê avaliações" on public.vita_feedback;
create policy "Empresa vê avaliações" on public.vita_feedback for select using (public.empresa_user_id() = user_id);
drop policy if exists "Membro avalia" on public.vita_feedback;
create policy "Membro avalia" on public.vita_feedback for insert with check (public.empresa_user_id() = user_id and autor_id = auth.uid());
drop policy if exists "Autor edita avaliação" on public.vita_feedback;
create policy "Autor edita avaliação" on public.vita_feedback for update using (autor_id = auth.uid());
drop policy if exists "Empresa apaga avaliações" on public.vita_feedback;
create policy "Empresa apaga avaliações" on public.vita_feedback for delete using (public.empresa_user_id() = user_id);

alter table public.vita_configuracao add column if not exists aprender_feedback boolean not null default true;
