-- Arquivos que a Vita gera (planilhas, PDFs, Word) ficam em <empresa>/vita/gerados/<id do usuário>/ e só esse
-- usuário os lê, lista ou apaga: um admin com acesso só à RM não enxerga o que um super admin gerou da Vital Norte.
drop policy if exists "Empresa lê arquivos de documentos" on storage.objects;
drop policy if exists "Empresa envia arquivos de documentos" on storage.objects;
drop policy if exists "Empresa remove arquivos de documentos" on storage.objects;

create policy "Empresa lê arquivos de documentos" on storage.objects for select
  using (bucket_id = 'documentos' and public.pasta_da_empresa((storage.foldername(name))[1])
         and (storage.foldername(name))[2] is distinct from 'notificacoes'
         and ((storage.foldername(name))[2] is distinct from 'vita' or (storage.foldername(name))[3] is distinct from 'gerados'
              or (storage.foldername(name))[4] = auth.uid()::text));
create policy "Empresa envia arquivos de documentos" on storage.objects for insert
  with check (bucket_id = 'documentos' and public.pasta_da_empresa((storage.foldername(name))[1])
              and (storage.foldername(name))[2] is distinct from 'notificacoes'
              and ((storage.foldername(name))[2] is distinct from 'vita' or (storage.foldername(name))[3] is distinct from 'gerados'
                   or (storage.foldername(name))[4] = auth.uid()::text));
create policy "Empresa remove arquivos de documentos" on storage.objects for delete
  using (bucket_id = 'documentos' and public.pasta_da_empresa((storage.foldername(name))[1])
         and (storage.foldername(name))[2] is distinct from 'notificacoes'
         and ((storage.foldername(name))[2] is distinct from 'vita' or (storage.foldername(name))[3] is distinct from 'gerados'
              or (storage.foldername(name))[4] = auth.uid()::text));
