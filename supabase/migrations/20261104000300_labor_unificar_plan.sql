-- Una sola lista de labores: "por hacer" (programado) o "hecho" (realizado). Lo por hacer puede no saber aún las personas.
alter table public.labor_registro alter column personas drop not null;
alter table public.labor_registro alter column jornadas drop not null;
alter table public.labor_registro add constraint labor_registro_hecho_completo check (estado = 'programado' or (personas is not null and jornadas is not null));

-- Lo planificado pendiente pasa a "por hacer" (desde hoy o el lunes de su semana, lo que sea después)
insert into public.labor_registro (fecha, cuartel_id, variedad_id, labor_tipo_id, cuadrilla_id, fiscalizador_id, personas, jornadas, modalidad, observacion, plan_id, creado_por, estado)
select greatest(p.semana, (now() at time zone 'America/Santiago')::date), p.cuartel_id, p.variedad_id, p.labor_tipo_id, p.cuadrilla_id, p.fiscalizador_id,
       p.personas_previstas, p.personas_previstas, 'dia', p.observacion, p.id, p.creado_por, 'programado'
from public.labor_plan p
where p.estado = 'pendiente' and not exists (select 1 from public.labor_registro r where r.plan_id = p.id);
update public.labor_plan set estado = 'hecha' where estado = 'pendiente' and exists (select 1 from public.labor_registro r where r.plan_id = labor_plan.id);
