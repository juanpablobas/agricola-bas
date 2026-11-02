-- =====================================================================
-- Etapa 3 (parte 1): inventario de insumos
--   · Productos, ingresos y salidas. El stock es ingresos menos salidas.
--   · Se carga desde el archivo "Inventario" del administrador; además se pueden
--     registrar salidas a mano en la app (cada una queda con quién la hizo).
-- =====================================================================

create table public.producto (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  nombre_clave   text not null unique,          -- minúsculas, sin espacios dobles
  clasificacion  text not null check (clasificacion in ('Pesticida', 'Herbicida', 'Fertilizante', 'Insumos')),
  unidad         text check (unidad in ('Kg', 'L', 'un', 'm', 'rollo')),   -- el archivo no la trae
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

create table public.carga_inventario (
  id          uuid primary key default gen_random_uuid(),
  archivo     text not null,
  ingresos    int not null default 0,
  salidas     int not null default 0,
  desde       date,
  hasta       date,
  estado      text not null default 'vigente' check (estado in ('vigente', 'reemplazada')),
  subido_por  uuid references auth.users (id) on delete set null,
  creado_en   timestamptz not null default now()
);

create table public.mov_inventario (
  id                uuid primary key default gen_random_uuid(),
  carga_id          uuid references public.carga_inventario (id) on delete cascade,
  tipo              text not null check (tipo in ('ingreso', 'salida')),
  fecha             date not null,
  producto_id       uuid not null references public.producto (id) on delete restrict,
  cantidad          numeric(14, 3) not null check (cantidad > 0),
  valor_unitario    numeric(14, 4),
  valor_total       numeric(14, 2),
  proveedor         text,
  factura           text,
  ceco_id           uuid references public.ceco (id) on delete restrict,   -- destino de una salida
  destino_original  text,                                                  -- lo que decía el Excel (Distribuir, Desuso…)
  observacion       text,
  origen            text not null default 'archivo' check (origen in ('archivo', 'manual')),
  creado_por        uuid references auth.users (id) on delete set null,
  creado_en         timestamptz not null default now()
);

create index mov_inventario_producto on public.mov_inventario (producto_id, fecha);
create index mov_inventario_carga on public.mov_inventario (carga_id);

-- Stock por producto. El costo promedio solo usa ingresos con valor (el stock inicial viene sin valor).
create or replace view public.v_stock
with (security_invoker = true) as
select p.id as producto_id, p.nombre, p.clasificacion, p.unidad, p.activo,
       coalesce(sum(m.cantidad) filter (where m.tipo = 'ingreso'), 0) as ingresos,
       coalesce(sum(m.cantidad) filter (where m.tipo = 'salida'), 0)  as salidas,
       coalesce(sum(m.cantidad) filter (where m.tipo = 'ingreso'), 0)
         - coalesce(sum(m.cantidad) filter (where m.tipo = 'salida'), 0) as stock,
       case when coalesce(sum(m.cantidad) filter (where m.tipo = 'ingreso' and m.valor_total > 0), 0) > 0
            then sum(m.valor_total) filter (where m.tipo = 'ingreso' and m.valor_total > 0)
               / sum(m.cantidad) filter (where m.tipo = 'ingreso' and m.valor_total > 0) end as costo_promedio,
       max(m.fecha) as ultimo_movimiento
  from public.producto p
  left join public.mov_inventario m on m.producto_id = p.id
 group by p.id;

alter table public.producto         enable row level security;
alter table public.carga_inventario enable row level security;
alter table public.mov_inventario   enable row level security;

create policy producto_ver on public.producto for select
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
create policy producto_crear on public.producto for insert
  with check (public.tiene_rol('administrador', 'enc_administrativo'));
create policy producto_editar on public.producto for update
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'))
  with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));

create policy carga_inventario_ver on public.carga_inventario for select
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
create policy carga_inventario_crear on public.carga_inventario for insert
  with check (public.tiene_rol('administrador', 'enc_administrativo'));
create policy carga_inventario_editar on public.carga_inventario for update
  using (public.tiene_rol('administrador', 'enc_administrativo'))
  with check (public.tiene_rol('administrador', 'enc_administrativo'));

create policy mov_inventario_ver on public.mov_inventario for select
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario'));
create policy mov_inventario_crear_archivo on public.mov_inventario for insert
  with check (origen = 'archivo' and public.tiene_rol('administrador', 'enc_administrativo'));
create policy mov_inventario_crear_manual on public.mov_inventario for insert
  with check (origen = 'manual' and tipo = 'salida' and creado_por = auth.uid()
              and public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy mov_inventario_borrar on public.mov_inventario for delete
  using (public.tiene_rol('administrador', 'enc_administrativo'));

create trigger auditar after insert or update or delete on public.producto
  for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.carga_inventario
  for each row execute function public.registrar_auditoria();
-- Los movimientos manuales se auditan; los del archivo se rastrean por su carga.
create trigger auditar_ins after insert on public.mov_inventario
  for each row when (new.origen = 'manual') execute function public.registrar_auditoria();
create trigger auditar_upd after update on public.mov_inventario
  for each row when (new.origen = 'manual' or old.origen = 'manual') execute function public.registrar_auditoria();
create trigger auditar_del after delete on public.mov_inventario
  for each row when (old.origen = 'manual') execute function public.registrar_auditoria();
