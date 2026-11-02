-- =====================================================================
-- Etapa 3 · Labores: cuadrillas (jefes de cuadrilla), tipos de labor, plan semanal y registro diario.
--   · El registro se hace por fecha, cuartel, labor y cuadrilla, en jornadas (1 jornada = 1 persona por 1 día).
--   · El monto pagado va en una tabla aparte, porque lo ven solo administración, finanzas y propietario.
-- =====================================================================
create table public.cuadrilla (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  jefe      text,
  tipo      text not null default 'contratista' check (tipo in ('propia', 'contratista')),
  telefono  text,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.labor_tipo (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null unique,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.labor_plan (
  id                 uuid primary key default gen_random_uuid(),
  semana             date not null,                        -- el lunes de la semana
  cuartel_id         uuid references public.cuartel (id) on delete restrict,
  labor_tipo_id      uuid not null references public.labor_tipo (id) on delete restrict,
  cuadrilla_id       uuid references public.cuadrilla (id) on delete set null,
  personas_previstas int check (personas_previstas > 0),
  observacion        text,
  estado             text not null default 'pendiente' check (estado in ('pendiente', 'hecha', 'cancelada')),
  creado_por         uuid references auth.users (id) on delete set null,
  creado_en          timestamptz not null default now(),
  check (extract(isodow from semana) = 1)
);
create index labor_plan_semana on public.labor_plan (semana);

create table public.labor_registro (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,
  cuartel_id    uuid references public.cuartel (id) on delete restrict,   -- vacío = labor general del campo
  labor_tipo_id uuid not null references public.labor_tipo (id) on delete restrict,
  cuadrilla_id  uuid references public.cuadrilla (id) on delete set null,
  personas      int not null check (personas > 0 and personas <= 500),
  jornadas      numeric(8, 2) not null check (jornadas > 0 and jornadas <= 5000),
  modalidad     text not null default 'dia' check (modalidad in ('dia', 'trato')),
  observacion   text,
  plan_id       uuid references public.labor_plan (id) on delete set null,
  creado_por    uuid references auth.users (id) on delete set null,
  creado_en     timestamptz not null default now()
);
create index labor_registro_fecha on public.labor_registro (fecha desc);
create index labor_registro_cuartel on public.labor_registro (cuartel_id);

create table public.labor_pago (
  id           uuid primary key default gen_random_uuid(),
  registro_id  uuid not null unique references public.labor_registro (id) on delete cascade,
  monto        numeric(14, 0) not null check (monto >= 0),
  creado_en    timestamptz not null default now()
);

alter table public.cuadrilla      enable row level security;
alter table public.labor_tipo     enable row level security;
alter table public.labor_plan     enable row level security;
alter table public.labor_registro enable row level security;
alter table public.labor_pago     enable row level security;

-- Ver: administrador, encargado administrativo, encargado agrícola y propietario
-- Crear y editar: administrador, encargado administrativo y encargado agrícola
do $$
declare t text;
begin
  foreach t in array array['cuadrilla', 'labor_tipo', 'labor_plan', 'labor_registro'] loop
    execute format('create policy %I on public.%I for select using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola'', ''propietario''))', t || '_ver', t);
    execute format('create policy %I on public.%I for insert with check (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola''))', t || '_crear', t);
    execute format('create policy %I on public.%I for update using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola'')) with check (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola''))', t || '_editar', t);
  end loop;
end $$;
create policy labor_plan_borrar on public.labor_plan for delete
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy labor_registro_borrar on public.labor_registro for delete
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));

-- El monto lo ve y lo maneja solo administración (el propietario solo mira)
create policy labor_pago_ver on public.labor_pago for select
  using (public.tiene_rol('administrador', 'enc_administrativo', 'propietario'));
create policy labor_pago_crear on public.labor_pago for insert
  with check (public.tiene_rol('administrador', 'enc_administrativo'));
create policy labor_pago_editar on public.labor_pago for update
  using (public.tiene_rol('administrador', 'enc_administrativo')) with check (public.tiene_rol('administrador', 'enc_administrativo'));
create policy labor_pago_borrar on public.labor_pago for delete
  using (public.tiene_rol('administrador', 'enc_administrativo'));

create trigger auditar after insert or update or delete on public.cuadrilla      for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.labor_plan     for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.labor_registro for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.labor_pago     for each row execute function public.registrar_auditoria();

-- Tipos de labor de partida (se pueden agregar y desactivar desde la app)
insert into public.labor_tipo (nombre) values
  ('Poda'), ('Raleo'), ('Cosecha'), ('Amarra'), ('Desbrote'), ('Deshierbe'),
  ('Aplicación'), ('Fertilización'), ('Riego'), ('Mantención'), ('Otra');
