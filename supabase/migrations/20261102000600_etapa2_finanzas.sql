-- =====================================================================
-- Etapa 2: finanzas (presupuesto vs gasto real)
--   · Todos los montos van CON IVA, igual que el presupuesto y el control
--     del administrador externo. Del gasto se guarda además neto, IVA y exento.
--   · Los centros de costo (CECO) del administrador van por variedad (C221 = Chandler, etc.).
--   · Presupuesto y gastos se cargan desde los Excel mensuales; cada carga queda registrada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Centros de costo del administrador externo
-- ---------------------------------------------------------------------
create table public.ceco (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null unique,            -- C221
  numero               int,                             -- 2000 (columna "Centro de Costo" de la remesa)
  nombre               text not null,
  tipo                 text not null check (tipo in ('general', 'variedad')),
  variedad_id          uuid references public.variedad (id) on delete restrict,
  ceco_presupuesto_id  uuid references public.ceco (id) on delete restrict, -- si se presupuesta dentro de otro CECO
  activo               boolean not null default true,
  creado_en            timestamptz not null default now(),
  constraint ceco_variedad check (tipo = 'variedad' or variedad_id is null)
);

create table public.proveedor (
  id         uuid primary key default gen_random_uuid(),
  rut        text not null unique,
  nombre     text not null,
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Cargas de archivos (trazabilidad de qué Excel originó cada dato)
-- ---------------------------------------------------------------------
create table public.carga_finanzas (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('presupuesto', 'gastos')),
  temporada_id  uuid not null references public.temporada (id) on delete restrict,
  archivo       text not null,
  filas         int not null default 0,
  total         numeric(16, 2) not null default 0,
  desde         date,
  hasta         date,
  estado        text not null default 'vigente' check (estado in ('vigente', 'reemplazada')),
  observaciones text,
  subido_por    uuid references auth.users (id) on delete set null,
  creado_en     timestamptz not null default now()
);

create index carga_finanzas_tipo on public.carga_finanzas (tipo, temporada_id, estado);

-- ---------------------------------------------------------------------
-- Presupuesto (un monto por ítem, CECO, labor y mes)
-- ---------------------------------------------------------------------
create table public.presupuesto_linea (
  id            uuid primary key default gen_random_uuid(),
  carga_id      uuid not null references public.carga_finanzas (id) on delete cascade,
  temporada_id  uuid not null references public.temporada (id) on delete restrict,
  ceco_id       uuid not null references public.ceco (id) on delete restrict,
  item          text not null,
  labor         text,
  sublabor      text,
  udc           text,
  mes           date not null check (mes = date_trunc('month', mes)::date),
  monto         numeric(14, 2) not null,
  cerrado       boolean not null default false
);

create index presupuesto_linea_clave on public.presupuesto_linea (temporada_id, ceco_id, item, mes);
create index presupuesto_linea_carga on public.presupuesto_linea (carga_id);

-- ---------------------------------------------------------------------
-- Gastos reales (un registro por línea de la remesa del administrador)
-- ---------------------------------------------------------------------
create table public.gasto (
  id                uuid primary key default gen_random_uuid(),
  carga_id          uuid not null references public.carga_finanzas (id) on delete cascade,
  temporada_id      uuid not null references public.temporada (id) on delete restrict,
  ceco_id           uuid references public.ceco (id) on delete restrict,  -- vacío si aún no se asigna
  ceco_original     text,                                                  -- lo que decía el Excel
  proveedor_id      uuid references public.proveedor (id) on delete restrict,
  item              text not null,
  sublabor_ppto     text,
  tipo_documento    text,
  numero_documento  text,
  fecha             date not null,
  semana            int,
  detalle           text,
  exento            numeric(14, 2) not null default 0,
  neto              numeric(14, 2) not null default 0,
  iva               numeric(14, 2) not null default 0,
  total             numeric(14, 2) not null,
  sin_presupuesto   boolean not null default false
);

create index gasto_clave on public.gasto (temporada_id, ceco_id, item, fecha);
create index gasto_proveedor on public.gasto (proveedor_id);
create index gasto_carga on public.gasto (carga_id);

-- ---------------------------------------------------------------------
-- Presupuesto vs real, por temporada, CECO (agrupado), ítem y mes
-- ---------------------------------------------------------------------
create or replace view public.v_presupuesto_real
with (security_invoker = true) as
with p as (
  select pl.temporada_id, coalesce(c.ceco_presupuesto_id, c.id) as ceco_id, pl.item, pl.mes,
         sum(pl.monto) as presupuesto
    from public.presupuesto_linea pl
    join public.ceco c on c.id = pl.ceco_id
   group by 1, 2, 3, 4
), g as (
  select g.temporada_id, coalesce(c.ceco_presupuesto_id, c.id) as ceco_id, g.item,
         date_trunc('month', g.fecha)::date as mes,
         sum(g.total) as real
    from public.gasto g
    left join public.ceco c on c.id = g.ceco_id
   group by 1, 2, 3, 4
)
select coalesce(p.temporada_id, g.temporada_id) as temporada_id,
       coalesce(p.ceco_id, g.ceco_id)           as ceco_id,
       c.codigo                                 as ceco_codigo,
       coalesce(c.nombre, 'Sin asignar')        as ceco_nombre,
       c.variedad_id,
       coalesce(p.item, g.item)                 as item,
       coalesce(p.mes, g.mes)                   as mes,
       coalesce(p.presupuesto, 0)               as presupuesto,
       coalesce(g.real, 0)                      as real
  from p
  full join g
    on g.temporada_id = p.temporada_id
   and g.ceco_id is not distinct from p.ceco_id
   and g.item = p.item
   and g.mes = p.mes
  left join public.ceco c on c.id = coalesce(p.ceco_id, g.ceco_id);

-- ---------------------------------------------------------------------
-- Permisos: ven administrador, encargado administrativo y propietario;
-- cargan y corrigen administrador y encargado administrativo.
-- ---------------------------------------------------------------------
alter table public.ceco              enable row level security;
alter table public.proveedor         enable row level security;
alter table public.carga_finanzas    enable row level security;
alter table public.presupuesto_linea enable row level security;
alter table public.gasto             enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ceco', 'proveedor', 'carga_finanzas', 'presupuesto_linea', 'gasto'] loop
    execute format('create policy %I on public.%I for select using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''propietario''))', t || '_ver', t);
    execute format('create policy %I on public.%I for insert with check (public.tiene_rol(''administrador'', ''enc_administrativo''))', t || '_crear', t);
    execute format('create policy %I on public.%I for update using (public.tiene_rol(''administrador'', ''enc_administrativo'')) with check (public.tiene_rol(''administrador'', ''enc_administrativo''))', t || '_editar', t);
    execute format('create policy %I on public.%I for delete using (public.tiene_rol(''administrador'', ''enc_administrativo''))', t || '_borrar', t);
  end loop;
end $$;

-- Auditoría de los datos maestros y de cada carga (las líneas se rastrean por su carga)
create trigger auditar after insert or update or delete on public.ceco
  for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.proveedor
  for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.carga_finanzas
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------
-- Datos: CECO del administrador (los de variedad se enlazan a la variedad del campo)
-- ---------------------------------------------------------------------
insert into public.ceco (codigo, numero, nombre, tipo) values
  ('C111', 1000, 'General campo',       'general'),
  ('C112', 1100, 'Bodega',              'general'),
  ('C113', 1200, 'Administración',      'general'),
  ('C114', 1300, 'Casas patronales',    'general'),
  ('C115', null, 'Honorarios',         'general');

update public.ceco
   set ceco_presupuesto_id = (select id from public.ceco where codigo = 'C111')
 where codigo in ('C112', 'C113', 'C114', 'C115');

insert into public.ceco (codigo, numero, nombre, tipo, variedad_id)
select x.codigo, x.numero, v.nombre, 'variedad', v.id
  from (values
    ('C221', 2000, 'Chandler'),
    ('C331', 3000, 'Lapins'),
    ('C332', 3000, 'Areko'),
    ('C333', 3000, 'Santina'),
    ('C441', 4000, 'Soledora'),
    ('C551', 5000, 'Tiffany'),
    ('C552', 5000, 'Luciana'),
    ('C553', 5000, 'Garcica'),
    ('C661', 6000, 'Red Phoenix'),
    ('C662', 6000, 'Candy Red')
  ) as x(codigo, numero, variedad)
  join public.variedad v on v.nombre = x.variedad;
