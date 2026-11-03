-- Vínculo entre cada zona de Drop Control y el sector de riego de la app (para saber qué cultivos riega cada una)
create table public.dropcontrol_zona (
  zona_id text primary key,
  zona_nombre text,
  sector_id uuid references public.sector_riego(id) on delete set null,
  actualizado_por uuid references auth.users(id),
  actualizado_en timestamptz not null default now()
);
alter table public.dropcontrol_zona enable row level security;
create policy dc_zona_ver on public.dropcontrol_zona for select to authenticated
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
create policy dc_zona_ins on public.dropcontrol_zona for insert to authenticated
  with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy dc_zona_upd on public.dropcontrol_zona for update to authenticated
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola')) with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy dc_zona_del on public.dropcontrol_zona for delete to authenticated
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
