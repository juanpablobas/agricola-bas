-- Aplicaciones del programa que se postergan (por ejemplo por lluvia) o que ya no se harán.
create table public.aplicacion_estado (
  id                     uuid primary key default gen_random_uuid(),
  programa_aplicacion_id uuid not null references public.programa_aplicacion (id) on delete cascade,
  variedad_id            uuid not null references public.variedad (id) on delete cascade,
  estado                 text not null check (estado in ('postergada', 'omitida')),
  motivo                 text,
  nueva_fecha            date,
  creado_por             uuid references auth.users (id) on delete set null,
  creado_en              timestamptz not null default now(),
  unique (programa_aplicacion_id, variedad_id)
);
alter table public.aplicacion_estado enable row level security;
create policy aplicacion_estado_ver on public.aplicacion_estado for select
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
create policy aplicacion_estado_crear on public.aplicacion_estado for insert
  with check (creado_por = auth.uid() and public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy aplicacion_estado_editar on public.aplicacion_estado for update
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'))
  with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy aplicacion_estado_borrar on public.aplicacion_estado for delete
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create trigger auditar after insert or update or delete on public.aplicacion_estado
  for each row execute function public.registrar_auditoria();
