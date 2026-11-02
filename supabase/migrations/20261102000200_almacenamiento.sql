-- Bucket privado para fotos y documentos
insert into storage.buckets (id, name, public, file_size_limit)
values ('archivos', 'archivos', false, 52428800)   -- 50 MB por archivo
on conflict (id) do nothing;

create policy archivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'archivos' and public.es_usuario_activo());

create policy archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos'
              and public.tiene_rol('administrador', 'enc_agricola', 'enc_administrativo'));

create policy archivos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and public.tiene_rol('administrador'));
