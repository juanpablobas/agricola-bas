-- Labores por variedad completa (por ejemplo "Santina completa"): en vez de un cuartel, toda la variedad.
alter table public.labor_registro add column variedad_id uuid references public.variedad(id) on delete restrict;
alter table public.labor_plan add column variedad_id uuid references public.variedad(id) on delete restrict;
alter table public.labor_registro add constraint labor_registro_un_destino check (cuartel_id is null or variedad_id is null);
alter table public.labor_plan add constraint labor_plan_un_destino check (cuartel_id is null or variedad_id is null);
create index labor_registro_variedad_idx on public.labor_registro (variedad_id);
