-- Las aplicaciones cargadas desde la planilla no traen litros por hectárea
alter table public.aplicacion_realizada alter column litros_ha drop not null;
