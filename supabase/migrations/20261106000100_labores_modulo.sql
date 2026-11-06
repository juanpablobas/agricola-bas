-- Módulo de labores: estados completos, fechas reales, avance, personal propio o contratista, costos, historial y catálogo por categorías.
-- Todo es aditivo (no borra columnas) para poder volver a la versión anterior si se quiere.

alter table public.labor_registro drop constraint if exists labor_registro_estado_check;
alter table public.labor_registro add constraint labor_registro_estado_check
  check (estado in ('programado', 'en_ejecucion', 'realizado', 'reprogramado', 'cancelado'));
alter table public.labor_registro drop constraint if exists labor_registro_hecho_completo;

alter table public.labor_registro
  add column if not exists fecha_original date,
  add column if not exists fecha_inicio date,
  add column if not exists fecha_termino date,
  add column if not exists cantidad_plan numeric(12,2) check (cantidad_plan >= 0),
  add column if not exists cantidad_ejecutada numeric(12,2) check (cantidad_ejecutada >= 0),
  add column if not exists unidad_cantidad text check (unidad_cantidad in ('ha', 'arbol', 'hilera', 'jornada', 'unidad')),
  add column if not exists ejecucion text not null default 'propio' check (ejecucion in ('propio', 'contratista')),
  add column if not exists horas numeric(10,2) check (horas >= 0),
  add column if not exists valor_jornal numeric(12,0) check (valor_jornal >= 0),
  add column if not exists valor_hora numeric(12,0) check (valor_hora >= 0),
  add column if not exists cobro text check (cobro in ('ha', 'arbol', 'jornada', 'unidad', 'fijo')),
  add column if not exists precio_unitario numeric(14,2) check (precio_unitario >= 0),
  add column if not exists estado_pago text not null default 'pendiente' check (estado_pago in ('pendiente', 'parcial', 'pagado')),
  add column if not exists monto_pagado numeric(14,0) check (monto_pagado >= 0),
  add column if not exists documento text,
  add column if not exists costo_maquinaria numeric(14,0) check (costo_maquinaria >= 0),
  add column if not exists costo_insumos numeric(14,0) check (costo_insumos >= 0),
  add column if not exists presupuesto numeric(14,0) check (presupuesto >= 0),
  add column if not exists confirmado_por uuid references auth.users(id) on delete set null,
  add column if not exists confirmado_en timestamptz,
  add column if not exists comentario_fiscalizador text;

update public.labor_registro set fecha_original = fecha where fecha_original is null;
update public.labor_registro set fecha_termino = fecha where estado = 'realizado' and fecha_termino is null;
update public.labor_registro set ejecucion = 'contratista' where cuadrilla_id in (select id from public.cuadrilla where tipo = 'contratista');
create index if not exists labor_registro_fecha_idx on public.labor_registro (fecha);

alter table public.cuadrilla add column if not exists rut text;

-- Trabajadores propios que participaron
create table if not exists public.labor_trabajador (
  labor_id uuid not null references public.labor_registro(id) on delete cascade,
  trabajador_id uuid not null references public.trabajador(id) on delete restrict,
  primary key (labor_id, trabajador_id)
);

-- Avances parciales (hasta completar el 100 %)
create table if not exists public.labor_avance (
  id uuid primary key default gen_random_uuid(),
  labor_id uuid not null references public.labor_registro(id) on delete cascade,
  fecha date not null,
  cantidad numeric(12,2) not null check (cantidad > 0),
  observacion text,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists labor_avance_labor_idx on public.labor_avance (labor_id);

-- Historial: solo se agrega, nunca se modifica
create table if not exists public.labor_historial (
  id uuid primary key default gen_random_uuid(),
  labor_id uuid not null references public.labor_registro(id) on delete cascade,
  tipo text not null check (tipo in ('creada', 'estado', 'fecha', 'responsable', 'avance', 'edicion', 'pago', 'comentario')),
  estado_antes text,
  estado_despues text,
  fecha_antes date,
  fecha_despues date,
  motivo text,
  detalle text,
  usuario uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists labor_historial_labor_idx on public.labor_historial (labor_id, creado_en);

-- Catálogo: categoría y especies a las que aplica (vacío = todas)
alter table public.labor_tipo add column if not exists categoria text;
alter table public.labor_tipo add column if not exists especies uuid[];

alter table public.labor_trabajador enable row level security;
alter table public.labor_avance enable row level security;
alter table public.labor_historial enable row level security;

create policy labor_trabajador_ver on public.labor_trabajador for select using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario', 'operario'));
create policy labor_trabajador_crear on public.labor_trabajador for insert with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy labor_trabajador_borrar on public.labor_trabajador for delete using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));

create policy labor_avance_ver on public.labor_avance for select using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario', 'operario'));
create policy labor_avance_crear on public.labor_avance for insert with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy labor_avance_borrar on public.labor_avance for delete using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));

create policy labor_historial_ver on public.labor_historial for select using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario', 'operario'));
create policy labor_historial_crear on public.labor_historial for insert with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));

create trigger auditar after insert or update or delete on public.labor_avance for each row execute function public.registrar_auditoria();

-- Categorías de las labores existentes
update public.labor_tipo set categoria = case nombre
  when 'Poda' then 'Poda'
  when 'Amarra' then 'Manejo vegetativo'
  when 'Desbrote' then 'Manejo vegetativo'
  when 'Raleo' then 'Manejo de fruta'
  when 'Deshierbe' then 'Malezas'
  when 'Aplicación' then 'Aplicaciones fitosanitarias'
  when 'Riego' then 'Riego y fertilización'
  when 'Fertilización' then 'Riego y fertilización'
  when 'Cosecha' then 'Cosecha y postcosecha'
  when 'Mantención' then 'Mantención'
  else 'Otras' end
where categoria is null;

-- Labores del catálogo base (se agregan solo las que no existen)
insert into public.labor_tipo (nombre, categoria)
select x.nombre, x.categoria from (values
  ('Poda de formación', 'Poda'), ('Poda de producción', 'Poda'), ('Poda de renovación', 'Poda'),
  ('Guiado', 'Manejo vegetativo'), ('Arqueo', 'Manejo vegetativo'), ('Anillado', 'Manejo vegetativo'), ('Deshoje', 'Manejo vegetativo'), ('Desoje', 'Manejo vegetativo'),
  ('Raleo químico', 'Manejo de fruta'), ('Regulación de carga', 'Manejo de fruta'),
  ('Desmalezado mecánico', 'Malezas'), ('Control químico de malezas', 'Malezas'),
  ('Aplicación fungicida', 'Aplicaciones fitosanitarias'), ('Aplicación insecticida', 'Aplicaciones fitosanitarias'), ('Aplicación acaricida', 'Aplicaciones fitosanitarias'), ('Aplicación foliar', 'Aplicaciones fitosanitarias'),
  ('Fertirriego', 'Riego y fertilización'), ('Fertilización al suelo', 'Riego y fertilización'), ('Fertilización foliar', 'Riego y fertilización'),
  ('Recolección', 'Cosecha y postcosecha'), ('Transporte de fruta', 'Cosecha y postcosecha'), ('Limpieza', 'Cosecha y postcosecha'), ('Evaluación de rendimiento', 'Cosecha y postcosecha'),
  ('Preparación de suelo', 'Suelo'), ('Subsolado', 'Suelo'), ('Rastraje', 'Suelo'), ('Enmiendas', 'Suelo'),
  ('Mantención de maquinaria', 'Mantención'), ('Mantención de infraestructura', 'Mantención'), ('Mantención de caminos', 'Mantención'), ('Mantención de cercos', 'Mantención'), ('Mantención de riego', 'Mantención'),
  ('Monitoreo de plagas', 'Monitoreo'), ('Monitoreo de enfermedades', 'Monitoreo'), ('Monitoreo de clima', 'Monitoreo'), ('Monitoreo del cultivo', 'Monitoreo')
) as x(nombre, categoria)
where not exists (select 1 from public.labor_tipo t where lower(t.nombre) = lower(x.nombre));

-- Historial inicial de las labores que ya existían
insert into public.labor_historial (labor_id, tipo, estado_despues, fecha_despues, detalle, usuario, creado_en)
select r.id, 'creada', r.estado, r.fecha, 'Registrada antes del módulo nuevo', r.creado_por, r.creado_en
from public.labor_registro r
where not exists (select 1 from public.labor_historial h where h.labor_id = r.id);
