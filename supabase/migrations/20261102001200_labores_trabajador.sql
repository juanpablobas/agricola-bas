-- Trabajadores del campo (quienes fiscalizan las labores) y quién fiscaliza cada labor.
create table public.trabajador (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null unique,
  vive_en_campo boolean not null default false,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);
alter table public.trabajador enable row level security;
create policy trabajador_ver on public.trabajador for select
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
create policy trabajador_crear on public.trabajador for insert
  with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy trabajador_editar on public.trabajador for update
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'))
  with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create trigger auditar after insert or update or delete on public.trabajador
  for each row execute function public.registrar_auditoria();

alter table public.labor_plan     add column fiscalizador_id uuid references public.trabajador (id) on delete set null;
alter table public.labor_registro add column fiscalizador_id uuid references public.trabajador (id) on delete set null;
