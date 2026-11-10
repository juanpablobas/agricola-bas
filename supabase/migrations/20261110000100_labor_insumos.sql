-- Insumos de bodega usados en una labor (herbicida, Podexal en poda, etc.), con descuento opcional del stock.
alter table public.mov_inventario add column if not exists labor_id uuid references public.labor_registro(id) on delete cascade;
create index if not exists mov_inventario_labor_idx on public.mov_inventario (labor_id);

create table if not exists public.labor_insumo (
  id uuid primary key default gen_random_uuid(),
  labor_id uuid not null references public.labor_registro(id) on delete cascade,
  producto_id uuid not null references public.producto(id) on delete restrict,
  cantidad numeric(14,4) not null check (cantidad > 0),
  costo_unitario numeric(14,2),           -- costo promedio de bodega con IVA, al momento de registrarlo
  descontar boolean not null default true, -- si se descuenta de bodega
  mov_id uuid references public.mov_inventario(id) on delete set null, -- salida de bodega (cuando ya se descontó)
  observacion text,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists labor_insumo_labor_idx on public.labor_insumo (labor_id);

alter table public.labor_insumo enable row level security;
create policy labor_insumo_ver on public.labor_insumo for select using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola', 'propietario', 'operario'));
create policy labor_insumo_crear on public.labor_insumo for insert with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy labor_insumo_editar on public.labor_insumo for update using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola')) with check (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy labor_insumo_borrar on public.labor_insumo for delete using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create trigger auditar after insert or update or delete on public.labor_insumo for each row execute function public.registrar_auditoria();

alter table public.labor_historial drop constraint if exists labor_historial_tipo_check;
alter table public.labor_historial add constraint labor_historial_tipo_check
  check (tipo in ('creada', 'estado', 'fecha', 'responsable', 'avance', 'edicion', 'pago', 'comentario', 'insumo'));

-- El encargado agrícola puede deshacer (borrar) las salidas de bodega que nacen de una labor
create policy mov_inventario_borrar_labor on public.mov_inventario for delete
  using (labor_id is not null and origen = 'manual' and public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
