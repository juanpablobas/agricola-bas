-- Precios de referencia (con IVA, por kg o litro) para comparar las opciones que da el asesor
create table public.precio_referencia (
  nombre_clave text primary key,
  nombre text not null,
  precio numeric not null check (precio > 0),
  actualizado date not null default current_date,
  actualizado_por uuid references auth.users(id)
);
alter table public.precio_referencia enable row level security;
create policy precio_ref_ver on public.precio_referencia for select to authenticated
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
create policy precio_ref_ins on public.precio_referencia for insert to authenticated
  with check (public.tiene_rol('administrador', 'enc_administrativo'));
create policy precio_ref_upd on public.precio_referencia for update to authenticated
  using (public.tiene_rol('administrador', 'enc_administrativo')) with check (public.tiene_rol('administrador', 'enc_administrativo'));
create policy precio_ref_del on public.precio_referencia for delete to authenticated
  using (public.tiene_rol('administrador', 'enc_administrativo'));
