-- Etapa 3: maquinaria y control de petróleo (carga de la planilla "Control Petróleo" del administrador)
create table public.maquina (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  tipo text not null default 'otro' check (tipo in ('tractor', 'camioneta', 'generador', 'otro')),
  marca text,
  propia boolean not null default true,
  activo boolean not null default true,
  observacion text,
  creado_en timestamptz not null default now()
);

create table public.carga_petroleo (
  id uuid primary key default gen_random_uuid(),
  archivo text not null,
  desde date,
  hasta date,
  entradas int not null default 0,
  salidas int not null default 0,
  estado text not null default 'vigente' check (estado in ('vigente', 'reemplazada')),
  subido_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);

create table public.mov_petroleo (
  id uuid primary key default gen_random_uuid(),
  carga_id uuid references public.carga_petroleo(id) on delete cascade,
  origen text not null default 'archivo' check (origen in ('archivo', 'manual')),
  fecha date not null,
  tipo text not null check (tipo in ('entrada', 'salida', 'saldo')),
  maquina_id uuid references public.maquina(id),
  operario text,
  cuartel_codigo text,
  especie text,
  variedad text,
  labor text,
  sublabor text,
  litros numeric(10,2) not null default 0 check (litros >= 0),
  precio_lt numeric(10,2),
  horometro numeric(10,1),
  km numeric(10,1),
  medidor numeric(12,1),
  hora text,
  factura text,
  proveedor text,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index mov_petroleo_fecha_idx on public.mov_petroleo (fecha);
create index mov_petroleo_maquina_idx on public.mov_petroleo (maquina_id);
create index mov_petroleo_carga_idx on public.mov_petroleo (carga_id);

alter table public.maquina enable row level security;
alter table public.carga_petroleo enable row level security;
alter table public.mov_petroleo enable row level security;

do $$
declare t text;
begin
  foreach t in array array['maquina', 'carga_petroleo', 'mov_petroleo'] loop
    execute format('create policy %I on public.%I for select using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola'', ''propietario''))', t || '_ver', t);
    execute format('create policy %I on public.%I for insert with check (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola''))', t || '_crear', t);
    execute format('create policy %I on public.%I for update using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola'')) with check (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola''))', t || '_editar', t);
    execute format('create policy %I on public.%I for delete using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola''))', t || '_borrar', t);
  end loop;
end $$;

create trigger auditar after insert or update or delete on public.maquina for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.carga_petroleo for each row execute function public.registrar_auditoria();
