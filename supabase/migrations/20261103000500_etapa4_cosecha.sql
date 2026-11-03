-- Etapa 4 (primera parte): cosecha por cuartel y día, con destino y conteo de baldes (nogales)
-- El costo de la cosecha se toma de Labores (labor "Cosecha" con cuartel y monto).
create table public.cosecha (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  cuartel_id uuid not null references public.cuartel(id),
  cuadrilla_id uuid references public.cuadrilla(id),
  kilos numeric(12,2) check (kilos is null or kilos >= 0),
  cantidad numeric(10,2) check (cantidad is null or cantidad >= 0),
  unidad text check (unidad is null or unidad in ('bins', 'cajas', 'bandejas', 'tarros', 'baldes')),
  destino text not null default 'exportadora' check (destino in ('exportadora', 'mercado_nacional', 'proceso', 'otro')),
  observacion text,
  creado_por uuid references auth.users(id),
  creado_en timestamptz not null default now()
);
create index cosecha_fecha_idx on public.cosecha (fecha);
create index cosecha_cuartel_idx on public.cosecha (cuartel_id);

create table public.cosecha_balde (
  id uuid primary key default gen_random_uuid(),
  cosecha_id uuid not null references public.cosecha(id) on delete cascade,
  persona text not null,
  baldes int not null check (baldes >= 0 and baldes <= 5000)
);
create index cosecha_balde_idx on public.cosecha_balde (cosecha_id);

alter table public.cosecha enable row level security;
alter table public.cosecha_balde enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cosecha', 'cosecha_balde'] loop
    execute format('create policy %I on public.%I for select using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola'', ''propietario''))', t || '_ver', t);
    execute format('create policy %I on public.%I for insert with check (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola''))', t || '_crear', t);
    execute format('create policy %I on public.%I for update using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola'')) with check (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola''))', t || '_editar', t);
    execute format('create policy %I on public.%I for delete using (public.tiene_rol(''administrador'', ''enc_administrativo'', ''enc_agricola''))', t || '_borrar', t);
  end loop;
end $$;

create trigger auditar after insert or update or delete on public.cosecha for each row execute function public.registrar_auditoria();
create trigger auditar after insert or update or delete on public.cosecha_balde for each row execute function public.registrar_auditoria();
