-- =====================================================================
-- Correcciones informadas por el campo (02-11-2026)
--   · 4-4b: sin plantar, sin variedad definida.
--   · 4-5a y 4-5b: sin plantar; se plantarán en 2027 con ciruelo AG 206.
--   · Carozos plantados en invierno de 2024.
--   · Portainjertos: Lapins y Santina en Colt; Areko y sus polinizantes
--     Kordia y Skeena en Gisela 12 (polinizante Lapins en Colt);
--     Tiffany, Luciana, Garcica y Soledora en Atlas.
--   · Polinizantes de Areko, Red Phoenix y Candy Red.
--   · La temporada de los controles del campo parte en mayo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Polinizantes por plantación
-- ---------------------------------------------------------------------
create table if not exists public.cuartel_polinizante (
  id            uuid primary key default gen_random_uuid(),
  periodo_id    uuid not null references public.cuartel_periodo (id) on delete cascade,
  variedad_id   uuid not null references public.variedad (id) on delete restrict,
  portainjerto  text,
  disposicion   text,          -- dónde va en el huerto
  creado_en     timestamptz not null default now(),
  unique (periodo_id, variedad_id)
);

alter table public.cuartel_polinizante enable row level security;

create policy cuartel_polinizante_ver on public.cuartel_polinizante for select
  using (public.es_usuario_activo());
create policy cuartel_polinizante_crear on public.cuartel_polinizante for insert
  with check (public.tiene_rol('administrador', 'enc_agricola'));
create policy cuartel_polinizante_editar on public.cuartel_polinizante for update
  using (public.tiene_rol('administrador', 'enc_agricola'))
  with check (public.tiene_rol('administrador', 'enc_agricola'));
create policy cuartel_polinizante_borrar on public.cuartel_polinizante for delete
  using (public.tiene_rol('administrador', 'enc_agricola'));

create trigger auditar after insert or update or delete on public.cuartel_polinizante
  for each row execute function public.registrar_auditoria();

-- Variedades polinizantes
insert into public.variedad (especie_id, nombre)
select e.id, v.nombre
from (values ('Cerezo', 'Kordia'), ('Cerezo', 'Skeena'), ('Ciruelo', 'Sweet Mary'), ('Ciruelo', 'Dapple Dandy')) as v(especie, nombre)
join public.especie e on e.nombre = v.especie
on conflict (especie_id, nombre) do nothing;

-- ---------------------------------------------------------------------
-- Temporada: mayo a abril, como los controles actuales del campo
-- ---------------------------------------------------------------------
update public.temporada
   set inicio = '2026-05-01', termino = '2027-04-30'
 where nombre = '2026-27';

-- ---------------------------------------------------------------------
-- Cuarteles sin plantar
-- ---------------------------------------------------------------------
update public.cuartel
   set estado_productivo = 'sin_plantar',
       observaciones = 'Sin plantar. Ciruelo, variedad por definir.'
 where codigo = '4-4b';

update public.cuartel_periodo p
   set variedad_id = null,
       motivo = 'Sin plantar; variedad por definir'
  from public.cuartel c
 where c.id = p.cuartel_id and c.codigo = '4-4b' and p.hasta is null;

-- 4-5 se separa en 4-5a (2,99 ha) y 4-5b (1,22 ha), ambos con el mismo sector de riego
update public.cuartel
   set codigo = '4-5a',
       superficie_ha = 2.99,
       estado_productivo = 'sin_plantar',
       observaciones = 'Sin plantar. Se plantará en 2027 con ciruelo AG 206.'
 where codigo = '4-5';

insert into public.cuartel (codigo, superficie_ha, estado_productivo, sistema_riego, observaciones)
select '4-5b', 1.22, 'sin_plantar', 'Goteo, doble línea', 'Sin plantar. Se plantará en 2027 con ciruelo AG 206.'
where not exists (select 1 from public.cuartel where codigo = '4-5b');

insert into public.cuartel_sector (cuartel_id, sector_id)
select c.id, s.id
from public.cuartel c, public.sector_riego s
where c.codigo = '4-5b' and s.codigo = '4-5'
on conflict do nothing;

insert into public.cuartel_periodo (cuartel_id, especie_id, variedad_id, distancia_hileras_m, distancia_plantas_m, anio_plantacion, motivo)
select c.id, e.id, v.id, 4.0, 2.0, 2027, 'Plantación programada para 2027'
from public.cuartel c
join public.especie e on e.nombre = 'Ciruelo'
join public.variedad v on v.especie_id = e.id and v.nombre = 'AG 206'
where c.codigo = '4-5b'
  and not exists (select 1 from public.cuartel_periodo p where p.cuartel_id = c.id);

update public.cuartel_periodo p
   set anio_plantacion = 2027,
       motivo = 'Plantación programada para 2027'
  from public.cuartel c
 where c.id = p.cuartel_id and c.codigo in ('4-5a', '4-5b') and p.hasta is null;

-- ---------------------------------------------------------------------
-- Carozos plantados: invierno de 2024 y portainjertos
-- ---------------------------------------------------------------------
update public.cuartel_periodo p
   set anio_plantacion = 2024,
       motivo = 'Plantación invierno 2024',
       portainjerto = case v.nombre
         when 'Lapins'   then 'Colt'
         when 'Santina'  then 'Colt'
         when 'Areko'    then 'Gisela 12'
         when 'Tiffany'  then 'Atlas'
         when 'Luciana'  then 'Atlas'
         when 'Garcica'  then 'Atlas'
         when 'Soledora' then 'Atlas'
         else p.portainjerto
       end
  from public.cuartel c, public.variedad v
 where c.id = p.cuartel_id
   and v.id = p.variedad_id
   and p.hasta is null
   and c.estado_productivo <> 'sin_plantar'
   and v.nombre in ('Lapins', 'Santina', 'Areko', 'Tiffany', 'Luciana', 'Garcica', 'Soledora', 'Red Phoenix', 'Candy Red');

-- ---------------------------------------------------------------------
-- Polinizantes
-- ---------------------------------------------------------------------
insert into public.cuartel_polinizante (periodo_id, variedad_id, portainjerto, disposicion)
select p.id, pv.id, x.portainjerto, x.disposicion
from (values
  ('Areko',       'Cerezo',  'Kordia',       'Gisela 12', 'Hilera polinizante cada 4 hileras (3 Kordia y 1 Skeena, patrón que se repite)'),
  ('Areko',       'Cerezo',  'Skeena',       'Gisela 12', 'En la hilera polinizante, junto a Kordia'),
  ('Areko',       'Cerezo',  'Lapins',       'Colt',      'Supernumeraria intercalada al medio del marco en las hileras de Areko'),
  ('Red Phoenix', 'Ciruelo', 'Sweet Mary',   null,        'En las cabeceras, ambas puntas de cada hilera'),
  ('Red Phoenix', 'Ciruelo', 'Candy Red',    null,        'Hilera polinizante completa cada 4 hileras'),
  ('Red Phoenix', 'Ciruelo', 'Dapple Dandy', null,        'Una planta cada 9 en la hilera polinizante'),
  ('Candy Red',   'Ciruelo', 'Sweet Mary',   null,        'En las cabeceras, ambas puntas de cada hilera'),
  ('Candy Red',   'Ciruelo', 'Red Phoenix',  null,        'Hilera polinizante completa cada 4 hileras'),
  ('Candy Red',   'Ciruelo', 'Dapple Dandy', null,        'Una planta cada 9 en la hilera polinizante')
) as x(principal, especie, polinizante, portainjerto, disposicion)
join public.especie e on e.nombre = x.especie
join public.variedad vp on vp.especie_id = e.id and vp.nombre = x.principal
join public.variedad pv on pv.especie_id = e.id and pv.nombre = x.polinizante
join public.cuartel_periodo p on p.variedad_id = vp.id and p.hasta is null
on conflict (periodo_id, variedad_id) do nothing;

-- Las plantas teóricas solo se calculan en cuarteles plantados
create or replace view public.v_cuartel
with (security_invoker = true) as
select
  c.id,
  c.codigo,
  c.nombre,
  c.superficie_ha,
  c.estado_productivo,
  c.sistema_riego,
  c.activo,
  c.observaciones,
  p.id                   as periodo_id,
  p.desde                as periodo_desde,
  e.id                   as especie_id,
  e.nombre               as especie,
  e.grupo                as grupo,
  v.id                   as variedad_id,
  v.nombre               as variedad,
  p.portainjerto,
  p.anio_plantacion,
  p.distancia_hileras_m,
  p.distancia_plantas_m,
  p.plantas,
  case when c.estado_productivo not in ('sin_plantar', 'eliminado')
        and p.distancia_hileras_m > 0 and p.distancia_plantas_m > 0
       then round(c.superficie_ha * 10000 / (p.distancia_hileras_m * p.distancia_plantas_m))::int
  end                    as plantas_teoricas,
  (select string_agg(s.codigo, ', ' order by s.codigo)
     from public.cuartel_sector cs join public.sector_riego s on s.id = cs.sector_id
    where cs.cuartel_id = c.id)                       as sectores,
  (select min(er.numero)
     from public.cuartel_sector cs
     join public.sector_riego s on s.id = cs.sector_id
     join public.equipo_riego er on er.id = s.equipo_id
    where cs.cuartel_id = c.id)                       as equipo,
  c.creado_en,
  c.actualizado_en
from public.cuartel c
left join public.cuartel_periodo p on p.cuartel_id = c.id and p.hasta is null
left join public.especie e on e.id = p.especie_id
left join public.variedad v on v.id = p.variedad_id;
