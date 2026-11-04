-- Trabajos con fecha futura quedan "programados" hasta que alguien confirme que se hicieron.
alter table public.labor_registro add column estado text not null default 'realizado' check (estado in ('programado', 'realizado'));
update public.labor_registro set estado = 'programado' where fecha > (now() at time zone 'America/Santiago')::date;
create index labor_registro_estado_idx on public.labor_registro (estado) where estado = 'programado';
