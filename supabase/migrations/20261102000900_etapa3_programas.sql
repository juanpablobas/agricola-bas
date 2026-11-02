-- =====================================================================
-- Etapa 3 · Programas fitosanitarios de los asesores y aplicaciones realizadas
--   · programa → aplicaciones (por estado fenológico y mes) → líneas de producto.
--   · Las dosis se guardan por 100 L de caldo (Kg o L por 100 L): al cambiar los litros
--     por hectárea (mojamiento real) la cantidad de producto se recalcula sola.
--   · El mojamiento real se define por variedad y mes; si no hay valor se usa el del programa.
--   · Registrar una aplicación (por variedad) genera las salidas de inventario asociadas.
-- =====================================================================
create table public.programa (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null unique,
  asesor        text,
  temporada_id  uuid references public.temporada (id) on delete restrict,
  archivo       text,
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create table public.programa_variedad (
  programa_id  uuid not null references public.programa (id) on delete cascade,
  variedad_id  uuid not null references public.variedad (id) on delete restrict,
  primary key (programa_id, variedad_id)
);

create table public.programa_aplicacion (
  id                 uuid primary key default gen_random_uuid(),
  programa_id        uuid not null references public.programa (id) on delete cascade,
  orden              int  not null,
  numero             int,
  titulo             text,
  estado_fenologico  text,
  fecha_estimada     text,
  mes                int  check (mes between 1 and 12),
  unique (programa_id, orden)
);

create table public.programa_linea (
  id                  uuid primary key default gen_random_uuid(),
  aplicacion_id       uuid not null references public.programa_aplicacion (id) on delete cascade,
  orden               int  not null,
  categoria           text,
  objetivo            text,
  producto            text not null,
  ingrediente_activo  text,
  grupo               text,
  unidad              text check (unidad in ('Kg', 'L')),
  conc_100l           numeric(14, 6),     -- Kg o L de producto por 100 L de caldo
  mojam_programa      numeric(8, 0),      -- L/ha que trae el programa
  dosis_ha            numeric(12, 4),     -- Kg o L por ha con el mojamiento del programa
  repeticiones        numeric(4, 1) not null default 1,
  caracter            text check (caracter in ('Fija', 'Variable', 'Alternativa')),
  relacion            text,               -- 'O' alternativa de la fila anterior, '+' junto con
  grupo_alt           int,
  alternativas        text,
  observacion         text,
  producto_id         uuid references public.producto (id) on delete set null
);
create index programa_linea_app on public.programa_linea (aplicacion_id);
create index programa_linea_producto on public.programa_linea (producto);

create table public.mojamiento_real (
  id             uuid not null default gen_random_uuid(),   -- para la auditoría
  variedad_id    uuid not null references public.variedad (id) on delete cascade,
  mes            int  not null check (mes between 1 and 12),
  litros_ha      numeric(8, 0) not null check (litros_ha > 0),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users (id) on delete set null,
  primary key (variedad_id, mes)
);

create table public.aplicacion_realizada (
  id                       uuid primary key default gen_random_uuid(),
  fecha                    date not null,
  variedad_id              uuid not null references public.variedad (id) on delete restrict,
  programa_aplicacion_id   uuid references public.programa_aplicacion (id) on delete set null,
  titulo                   text,
  litros_ha                numeric(8, 0) not null check (litros_ha > 0),
  ha                       numeric(9, 2) not null check (ha > 0),
  observacion              text,
  creado_por               uuid references auth.users (id) on delete set null,
  creado_en                timestamptz not null default now()
);
create index aplicacion_realizada_fecha on public.aplicacion_realizada (fecha desc);

alter table public.mov_inventario
  add column aplicacion_id uuid references public.aplicacion_realizada (id) on delete cascade;
create index mov_inventario_aplicacion on public.mov_inventario (aplicacion_id);

-- Permisos: ven administrador, encargado administrativo, encargado agrícola y propietario.
alter table public.programa             enable row level security;
alter table public.programa_variedad    enable row level security;
alter table public.programa_aplicacion  enable row level security;
alter table public.programa_linea       enable row level security;
alter table public.mojamiento_real      enable row level security;
alter table public.aplicacion_realizada enable row level security;

do $$
declare t text;
begin
  foreach t in array array['programa', 'programa_variedad', 'programa_aplicacion', 'programa_linea'] loop
    execute format('create policy %I on public.%I for select using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola'', ''propietario''))', t || '_ver', t);
    execute format('create policy %I on public.%I for insert with check (public.tiene_rol(''administrador'', ''enc_administrativo''))', t || '_crear', t);
    execute format('create policy %I on public.%I for update using (public.tiene_rol(''administrador'', ''enc_administrativo'')) with check (public.tiene_rol(''administrador'', ''enc_administrativo''))', t || '_editar', t);
    execute format('create policy %I on public.%I for delete using (public.tiene_rol(''administrador'', ''enc_administrativo''))', t || '_borrar', t);
  end loop;
end $$;

create policy mojamiento_real_ver on public.mojamiento_real for select
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
create policy mojamiento_real_crear on public.mojamiento_real for insert
  with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy mojamiento_real_editar on public.mojamiento_real for update
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'))
  with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy mojamiento_real_borrar on public.mojamiento_real for delete
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));

create policy aplicacion_realizada_ver on public.aplicacion_realizada for select
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
create policy aplicacion_realizada_crear on public.aplicacion_realizada for insert
  with check (creado_por = auth.uid() and public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy aplicacion_realizada_borrar on public.aplicacion_realizada for delete
  using (public.tiene_rol('administrador', 'enc_administrativo'));

create trigger auditar after insert or update or delete on public.programa
  for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.mojamiento_real
  for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.aplicacion_realizada
  for each row execute function public.registrar_auditoria();
