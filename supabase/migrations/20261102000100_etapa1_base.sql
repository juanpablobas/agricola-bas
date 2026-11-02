-- =====================================================================
-- Agrícola BAS · Fundo La Morera
-- Etapa 1: catastro del campo, cuarteles, usuarios, permisos y auditoría
-- =====================================================================

set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.rol_usuario as enum (
  'administrador',
  'enc_administrativo',
  'enc_agricola',
  'operario',
  'propietario'
);

create type public.estado_productivo as enum (
  'en_formacion',
  'productivo',
  'en_recambio',
  'sin_plantar',
  'eliminado'
);

create type public.estado_temporada as enum ('abierta', 'cerrada');

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Perfiles y roles
-- ---------------------------------------------------------------------
create table public.perfil (
  id             uuid primary key references auth.users (id) on delete cascade,
  nombre         text not null default '',
  email          text,
  rol            public.rol_usuario not null default 'operario',
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create trigger perfil_actualizado before update on public.perfil
  for each row execute function public.tocar_actualizado_en();

-- Rol del usuario conectado (null si no tiene perfil activo)
create or replace function public.rol_actual()
returns public.rol_usuario
language sql stable security definer set search_path = public as $$
  select rol from public.perfil where id = auth.uid() and activo
$$;

create or replace function public.tiene_rol(variadic roles public.rol_usuario[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() = any (roles), false)
$$;

create or replace function public.es_usuario_activo()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.rol_actual() is not null
$$;

-- Al crear un usuario en Auth se crea su perfil.
-- El primer usuario del sistema queda como administrador; los demás parten
-- como operario y el administrador les asigna el rol desde la app.
-- (El rol nunca se toma de los metadatos del registro: el usuario podría falsearlos.)
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  hay_admin boolean;
  rol_inicial public.rol_usuario;
begin
  select exists (select 1 from public.perfil where rol = 'administrador') into hay_admin;
  rol_inicial := case
    when not hay_admin then 'administrador'::public.rol_usuario
    else 'operario'::public.rol_usuario
  end;
  insert into public.perfil (id, nombre, email, rol)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', ''), new.email, rol_inicial)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Un administrador no puede quitarse a sí mismo el rol ni desactivarse
-- (evita dejar el sistema sin administrador).
create or replace function public.proteger_ultimo_admin()
returns trigger language plpgsql as $$
begin
  if old.rol = 'administrador' and (new.rol <> 'administrador' or not new.activo) then
    if not exists (
      select 1 from public.perfil
      where rol = 'administrador' and activo and id <> old.id
    ) then
      raise exception 'Debe quedar al menos un administrador activo';
    end if;
  end if;
  return new;
end $$;

create trigger perfil_proteger_admin before update on public.perfil
  for each row execute function public.proteger_ultimo_admin();

-- Cada usuario puede cambiar su propio nombre (y nada más de su perfil)
create or replace function public.actualizar_mi_nombre(p_nombre text)
returns void
language sql security definer set search_path = public as $$
  update public.perfil set nombre = left(trim(p_nombre), 120) where id = auth.uid() and activo
$$;

-- ---------------------------------------------------------------------
-- Campo y temporadas
-- ---------------------------------------------------------------------
create table public.campo (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  razon_social          text,
  rut                   text,
  direccion             text,
  comuna                text,
  region                text,
  superficie_total_ha   numeric(9,2) check (superficie_total_ha is null or superficie_total_ha >= 0),
  infraestructura       text,
  instalaciones_riego   text,
  observaciones         text,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

-- Un solo campo por instalación
create unique index campo_unico on public.campo ((true));

create trigger campo_actualizado before update on public.campo
  for each row execute function public.tocar_actualizado_en();

create table public.temporada (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  inicio         date not null,
  termino        date not null,
  estado         public.estado_temporada not null default 'abierta',
  creado_en      timestamptz not null default now(),
  constraint temporada_fechas check (inicio < termino)
);

-- Las temporadas no se traslapan
create extension if not exists btree_gist with schema extensions;
alter table public.temporada
  add constraint temporada_sin_traslape
  exclude using gist (daterange(inicio, termino, '[]') with &&);

create or replace function public.temporada_de(fecha date)
returns uuid language sql stable as $$
  select id from public.temporada where fecha between inicio and termino limit 1
$$;

-- ---------------------------------------------------------------------
-- Especies y variedades
-- ---------------------------------------------------------------------
create table public.especie (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  grupo     text,                       -- carozo, nogal, pomácea…
  creado_en timestamptz not null default now()
);

create table public.variedad (
  id         uuid primary key default gen_random_uuid(),
  especie_id uuid not null references public.especie (id) on delete restrict,
  nombre     text not null,
  creado_en  timestamptz not null default now(),
  unique (especie_id, nombre)
);

-- ---------------------------------------------------------------------
-- Riego: equipos y sectores
-- ---------------------------------------------------------------------
create table public.equipo_riego (
  id              uuid primary key default gen_random_uuid(),
  numero          int  not null unique,
  nombre          text not null,
  origen          text,                 -- caseta, cota
  emisor          text,
  filtro          text,
  bomba           text,
  observaciones   text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create trigger equipo_riego_actualizado before update on public.equipo_riego
  for each row execute function public.tocar_actualizado_en();

create table public.sector_riego (
  id                    uuid primary key default gen_random_uuid(),
  equipo_id             uuid not null references public.equipo_riego (id) on delete restrict,
  codigo                text not null unique,          -- ej. 4-2
  superficie_ha         numeric(9,2) check (superficie_ha is null or superficie_ha > 0),
  lineas_por_hilera     int,
  caudal_emisor_lh      numeric(6,2),
  distancia_emisores_m  numeric(6,2),
  precipitacion_mmh     numeric(6,2),
  horas_turno           numeric(5,2),
  observaciones         text,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

create trigger sector_riego_actualizado before update on public.sector_riego
  for each row execute function public.tocar_actualizado_en();

-- ---------------------------------------------------------------------
-- Cuarteles
-- ---------------------------------------------------------------------
create table public.cuartel (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,           -- ej. 4-4b
  nombre             text,
  superficie_ha      numeric(9,2) not null check (superficie_ha > 0),
  estado_productivo  public.estado_productivo not null default 'productivo',
  sistema_riego      text,
  activo             boolean not null default true,
  observaciones      text,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);

create trigger cuartel_actualizado before update on public.cuartel
  for each row execute function public.tocar_actualizado_en();

-- Un cuartel puede estar en varios sectores y un sector regar varios cuarteles
create table public.cuartel_sector (
  cuartel_id uuid not null references public.cuartel (id) on delete cascade,
  sector_id  uuid not null references public.sector_riego (id) on delete restrict,
  primary key (cuartel_id, sector_id)
);

-- Lo que está plantado en el cuartel, por período.
-- Un replante o reinjerto cierra el período vigente y abre otro.
create table public.cuartel_periodo (
  id                    uuid primary key default gen_random_uuid(),
  cuartel_id            uuid not null references public.cuartel (id) on delete cascade,
  desde                 date,                    -- null = sin fecha registrada
  hasta                 date,                    -- null = vigente
  especie_id            uuid not null references public.especie (id) on delete restrict,
  variedad_id           uuid references public.variedad (id) on delete restrict,
  portainjerto          text,
  anio_plantacion       int check (anio_plantacion is null or anio_plantacion between 1900 and 2100),
  distancia_hileras_m   numeric(5,2) check (distancia_hileras_m is null or distancia_hileras_m > 0),
  distancia_plantas_m   numeric(5,2) check (distancia_plantas_m is null or distancia_plantas_m > 0),
  plantas               int check (plantas is null or plantas >= 0),   -- conteo real
  motivo                text,                    -- plantación, reinjerto, replante…
  creado_en             timestamptz not null default now(),
  constraint periodo_fechas check (desde is null or hasta is null or desde <= hasta)
);

create unique index cuartel_periodo_un_vigente
  on public.cuartel_periodo (cuartel_id) where hasta is null;

-- La variedad debe pertenecer a la especie del período
create or replace function public.validar_variedad_periodo()
returns trigger language plpgsql as $$
begin
  if new.variedad_id is not null and not exists (
    select 1 from public.variedad v where v.id = new.variedad_id and v.especie_id = new.especie_id
  ) then
    raise exception 'La variedad no corresponde a la especie indicada';
  end if;
  return new;
end $$;

create trigger cuartel_periodo_validar before insert or update on public.cuartel_periodo
  for each row execute function public.validar_variedad_periodo();

-- Cambiar lo plantado en un cuartel de forma atómica
create or replace function public.nuevo_periodo_cuartel(
  p_cuartel_id uuid,
  p_desde date,
  p_especie_id uuid,
  p_variedad_id uuid,
  p_portainjerto text,
  p_anio_plantacion int,
  p_distancia_hileras_m numeric,
  p_distancia_plantas_m numeric,
  p_plantas int,
  p_motivo text
) returns uuid
language plpgsql security invoker as $$
declare
  nuevo_id uuid;
begin
  if p_desde is null then
    raise exception 'Indica la fecha desde la que rige el nuevo período';
  end if;
  update public.cuartel_periodo
     set hasta = p_desde - 1
   where cuartel_id = p_cuartel_id and hasta is null;
  insert into public.cuartel_periodo (
    cuartel_id, desde, especie_id, variedad_id, portainjerto, anio_plantacion,
    distancia_hileras_m, distancia_plantas_m, plantas, motivo
  ) values (
    p_cuartel_id, p_desde, p_especie_id, p_variedad_id, p_portainjerto, p_anio_plantacion,
    p_distancia_hileras_m, p_distancia_plantas_m, p_plantas, p_motivo
  ) returning id into nuevo_id;
  return nuevo_id;
end $$;

-- ---------------------------------------------------------------------
-- Centros de costo (cada cuartel tiene el suyo + centros generales)
-- ---------------------------------------------------------------------
create table public.centro_costo (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  nombre      text not null,
  tipo        text not null check (tipo in ('cuartel', 'general')),
  cuartel_id  uuid unique references public.cuartel (id) on delete restrict,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  constraint centro_tipo_cuartel check (
    (tipo = 'cuartel' and cuartel_id is not null) or (tipo = 'general' and cuartel_id is null)
  )
);

create or replace function public.crear_centro_costo_cuartel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.centro_costo (codigo, nombre, tipo, cuartel_id)
  values ('CU-' || new.codigo, 'Cuartel ' || new.codigo, 'cuartel', new.id)
  on conflict do nothing;
  return new;
end $$;

create trigger cuartel_crea_centro after insert on public.cuartel
  for each row execute function public.crear_centro_costo_cuartel();

create or replace function public.sincronizar_centro_costo_cuartel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.codigo <> old.codigo or new.activo <> old.activo then
    update public.centro_costo
       set codigo = 'CU-' || new.codigo,
           nombre = 'Cuartel ' || new.codigo,
           activo = new.activo
     where cuartel_id = new.id;
  end if;
  return new;
end $$;

create trigger cuartel_sincroniza_centro after update on public.cuartel
  for each row execute function public.sincronizar_centro_costo_cuartel();

-- ---------------------------------------------------------------------
-- Archivos (fotos y documentos) vinculados a cualquier registro
-- ---------------------------------------------------------------------
create table public.archivo (
  id          uuid primary key default gen_random_uuid(),
  ruta        text not null unique,        -- ruta dentro del bucket "archivos"
  nombre      text not null,
  mime        text,
  bytes       bigint,
  entidad     text not null,               -- 'cuartel', 'campo', …
  entidad_id  uuid,
  descripcion text,
  subido_por  uuid references public.perfil (id) on delete set null default auth.uid(),
  creado_en   timestamptz not null default now()
);

create index archivo_entidad on public.archivo (entidad, entidad_id);

-- ---------------------------------------------------------------------
-- Auditoría: cada inserción, edición y eliminación queda registrada
-- ---------------------------------------------------------------------
create table public.auditoria (
  id           bigint generated always as identity primary key,
  tabla        text not null,
  registro_id  text,
  accion       text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  antes        jsonb,
  despues      jsonb,
  usuario_id   uuid,
  fecha        timestamptz not null default now()
);

create index auditoria_tabla_registro on public.auditoria (tabla, registro_id);
create index auditoria_fecha on public.auditoria (fecha desc);

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_antes   jsonb;
  v_despues jsonb;
  v_id      text;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_antes := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_despues := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and v_antes - 'actualizado_en' = v_despues - 'actualizado_en' then
    return new;  -- nada cambió
  end if;
  v_id := coalesce(v_despues ->> 'id', v_antes ->> 'id',
                   v_despues ->> 'cuartel_id', v_antes ->> 'cuartel_id');
  insert into public.auditoria (tabla, registro_id, accion, antes, despues, usuario_id)
  values (tg_table_name, v_id, tg_op, v_antes, v_despues, auth.uid());
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'perfil', 'campo', 'temporada', 'especie', 'variedad', 'equipo_riego',
    'sector_riego', 'cuartel', 'cuartel_sector', 'cuartel_periodo',
    'centro_costo', 'archivo'
  ] loop
    execute format(
      'create trigger auditar after insert or update or delete on public.%I
         for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;

-- La auditoría no se modifica ni se borra
create or replace function public.auditoria_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'La auditoría no se puede modificar ni eliminar';
end $$;

create trigger auditoria_sin_cambios before update or delete on public.auditoria
  for each row execute function public.auditoria_inmutable();

-- ---------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------
create view public.v_cuartel
with (security_invoker = true) as
select
  c.id,
  c.codigo,
  c.nombre,
  c.superficie_ha,
  c.estado_productivo,
  c.sistema_riego,
  c.activo,
  c.observaciones,
  p.id                   as periodo_id,
  p.desde                as periodo_desde,
  e.id                   as especie_id,
  e.nombre               as especie,
  e.grupo                as grupo,
  v.id                   as variedad_id,
  v.nombre               as variedad,
  p.portainjerto,
  p.anio_plantacion,
  p.distancia_hileras_m,
  p.distancia_plantas_m,
  p.plantas,
  case when p.distancia_hileras_m > 0 and p.distancia_plantas_m > 0
       then round(c.superficie_ha * 10000 / (p.distancia_hileras_m * p.distancia_plantas_m))::int
  end                    as plantas_teoricas,
  (select string_agg(s.codigo, ', ' order by s.codigo)
     from public.cuartel_sector cs join public.sector_riego s on s.id = cs.sector_id
    where cs.cuartel_id = c.id)                       as sectores,
  (select min(er.numero)
     from public.cuartel_sector cs
     join public.sector_riego s on s.id = cs.sector_id
     join public.equipo_riego er on er.id = s.equipo_id
    where cs.cuartel_id = c.id)                       as equipo,
  c.creado_en,
  c.actualizado_en
from public.cuartel c
left join public.cuartel_periodo p on p.cuartel_id = c.id and p.hasta is null
left join public.especie e on e.id = p.especie_id
left join public.variedad v on v.id = p.variedad_id;

-- Nombres de usuarios, visibles para todo usuario activo (para mostrar
-- quién subió un archivo o hizo un cambio). No expone correo ni datos de acceso.
create view public.v_usuario as
select id, nombre, rol, activo
from public.perfil
where public.es_usuario_activo();

-- Bitácora con el nombre de quien hizo cada cambio.
-- Solo administrador y propietarios la ven.
create view public.v_actividad as
select a.*, pf.nombre as usuario_nombre, pf.email as usuario_email
from public.auditoria a
left join public.perfil pf on pf.id = a.usuario_id
where public.tiene_rol('administrador', 'propietario');

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------
alter table public.perfil          enable row level security;
alter table public.campo           enable row level security;
alter table public.temporada       enable row level security;
alter table public.especie         enable row level security;
alter table public.variedad        enable row level security;
alter table public.equipo_riego    enable row level security;
alter table public.sector_riego    enable row level security;
alter table public.cuartel         enable row level security;
alter table public.cuartel_sector  enable row level security;
alter table public.cuartel_periodo enable row level security;
alter table public.centro_costo    enable row level security;
alter table public.archivo         enable row level security;
alter table public.auditoria       enable row level security;

-- Perfil: cada uno ve el suyo; el administrador ve y edita todos.
create policy perfil_ver on public.perfil for select
  using (id = auth.uid() or public.tiene_rol('administrador'));
create policy perfil_editar on public.perfil for update
  using (public.tiene_rol('administrador'))
  with check (public.tiene_rol('administrador'));

-- Catastro: todo usuario activo lo ve; editan administrador y encargado agrícola.
do $$
declare t text;
begin
  foreach t in array array[
    'campo', 'especie', 'variedad', 'equipo_riego', 'sector_riego',
    'cuartel', 'cuartel_sector', 'cuartel_periodo'
  ] loop
    execute format('create policy %1$s_ver on public.%1$I for select using (public.es_usuario_activo())', t);
    execute format('create policy %1$s_crear on public.%1$I for insert
                      with check (public.tiene_rol(''administrador'', ''enc_agricola''))', t);
    execute format('create policy %1$s_editar on public.%1$I for update
                      using (public.tiene_rol(''administrador'', ''enc_agricola''))
                      with check (public.tiene_rol(''administrador'', ''enc_agricola''))', t);
  end loop;
end $$;

-- Borrar: solo el administrador, y solo en tablas de catálogo.
-- Los cuarteles y sus períodos no se borran: se desactivan o se cierran.
create policy especie_borrar on public.especie for delete using (public.tiene_rol('administrador'));
create policy variedad_borrar on public.variedad for delete using (public.tiene_rol('administrador'));
create policy sector_riego_borrar on public.sector_riego for delete using (public.tiene_rol('administrador'));
create policy cuartel_sector_borrar on public.cuartel_sector for delete
  using (public.tiene_rol('administrador', 'enc_agricola'));

-- Temporadas y centros de costo: los ve todo usuario activo;
-- editan administrador y encargado administrativo.
create policy temporada_ver on public.temporada for select using (public.es_usuario_activo());
create policy temporada_crear on public.temporada for insert
  with check (public.tiene_rol('administrador', 'enc_administrativo'));
create policy temporada_editar on public.temporada for update
  using (public.tiene_rol('administrador', 'enc_administrativo'))
  with check (public.tiene_rol('administrador', 'enc_administrativo'));

create policy centro_costo_ver on public.centro_costo for select using (public.es_usuario_activo());
create policy centro_costo_crear on public.centro_costo for insert
  with check (public.tiene_rol('administrador', 'enc_administrativo'));
create policy centro_costo_editar on public.centro_costo for update
  using (public.tiene_rol('administrador', 'enc_administrativo'))
  with check (public.tiene_rol('administrador', 'enc_administrativo'));

-- Archivos: los ve todo usuario activo; suben administrador y encargados.
create policy archivo_ver on public.archivo for select using (public.es_usuario_activo());
create policy archivo_crear on public.archivo for insert
  with check (public.tiene_rol('administrador', 'enc_agricola', 'enc_administrativo'));
create policy archivo_borrar on public.archivo for delete using (public.tiene_rol('administrador'));

-- Auditoría: solo administrador y propietarios.
create policy auditoria_ver on public.auditoria for select
  using (public.tiene_rol('administrador', 'propietario'));

-- Las funciones de rol se pueden llamar desde la app
grant execute on function public.rol_actual() to authenticated;
grant execute on function public.tiene_rol(public.rol_usuario[]) to authenticated;
grant execute on function public.es_usuario_activo() to authenticated;
grant execute on function public.actualizar_mi_nombre(text) to authenticated;
grant execute on function public.nuevo_periodo_cuartel(uuid, date, uuid, uuid, text, int, numeric, numeric, int, text) to authenticated;
