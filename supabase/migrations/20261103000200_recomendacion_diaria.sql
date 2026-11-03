-- Recomendación diaria escrita con IA (una por día). La escribe el servidor; los gestores la leen.
create table public.recomendacion_diaria (
  fecha date primary key,
  texto text not null,
  modelo text,
  creado_en timestamptz not null default now()
);
alter table public.recomendacion_diaria enable row level security;
create policy recomendacion_ver on public.recomendacion_diaria for select to authenticated
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
