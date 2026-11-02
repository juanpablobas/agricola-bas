-- =====================================================================
-- Datos reales del Fundo La Morera (Agrícola BAS S.A.)
-- Fuente: plano "Sectorización Fundo La Morera", HC Ingeniería,
--         versión 2, 27-03-2025, más correcciones informadas por el campo:
--   · Sector 1-4: se descuentan 0,50 ha por el tranque (queda en 4,53 ha).
--   · Cuartel 4-5 (a/b): ciruelo variedad AG 206.
--   · Variedad de nogal: Chandler.
-- Campos sin dato (año de plantación, portainjerto, plantas reales)
-- quedan vacíos para completarlos en la app. No se inventa nada.
-- =====================================================================

insert into public.campo (nombre, razon_social, comuna, region, observaciones)
values (
  'Fundo La Morera',
  'Agrícola BAS S.A.',
  'Graneros',
  'Región del Libertador General Bernardo O''Higgins',
  'Superficie total del predio por confirmar. Superficie plantada según plano de sectorización v2 (27-03-2025).'
);

-- Temporada propuesta (1 de junio a 31 de mayo). Ajustar si el campo usa otro período.
insert into public.temporada (nombre, inicio, termino)
values ('2026-27', '2026-06-01', '2027-05-31');

-- Especies y variedades
insert into public.especie (nombre, grupo) values
  ('Nogal', 'Nogal'),
  ('Cerezo', 'Carozo'),
  ('Nectarín', 'Carozo'),
  ('Durazno', 'Carozo'),
  ('Ciruelo', 'Carozo');

insert into public.variedad (especie_id, nombre)
select e.id, v.nombre
from (values
  ('Nogal', 'Chandler'),
  ('Cerezo', 'Lapins'),
  ('Cerezo', 'Areko'),
  ('Cerezo', 'Santina'),
  ('Nectarín', 'Tiffany'),
  ('Nectarín', 'Luciana'),
  ('Nectarín', 'Garcica'),
  ('Durazno', 'Soledora'),
  ('Ciruelo', 'Red Phoenix'),
  ('Ciruelo', 'Candy Red'),
  ('Ciruelo', 'AG 206')
) as v(especie, nombre)
join public.especie e on e.nombre = v.especie;

-- Equipos de riego (todos riegan desde la caseta en cota 526)
insert into public.equipo_riego (numero, nombre, origen, emisor, filtro, bomba, observaciones) values
  (1, 'Equipo 1 · Nogales', 'Caseta en cota 526',
   'Gotero integrado 4 l/h espaciado a 0,80 m, cuatro líneas',
   'Arena 36" x 6 unidades',
   '2 x SAER IR 50-200/NC con motor de 20 HP (2900 rpm), en paralelo',
   'Equipo existente'),
  (2, 'Equipo 2', 'Caseta en cota 526',
   'DripNet PC 16010/2,0 l/h espaciado a 0,50 m, doble línea (o similar)',
   'Anillos 130 micrones Spin Klin 2" x 6 unidades PN10 (Arkal), o Azud 206/6FX PN10',
   'Por definir', null),
  (3, 'Equipo 3', 'Caseta en cota 526',
   'DripNet PC 16010/2,0 l/h espaciado a 0,50 m, doble línea (o similar)',
   'Anillos 130 micrones Spin Klin 2" x 6 unidades PN10 (Arkal), o Azud 206/6FX PN10',
   'Por definir', null),
  (4, 'Equipo 4', 'Caseta en cota 526',
   'DripNet PC 16010/2,0 l/h espaciado a 0,50 m, doble línea (o similar)',
   'Anillos 130 micrones Spin Klin 3" x 6 unidades PN10 (Arkal), o Azud 307/8FX PN10',
   'Por definir', null),
  (5, 'Equipo 5', 'Caseta en cota 526',
   'DripNet PC 16010/2,0 l/h espaciado a 0,50 m, doble línea (o similar)',
   'Anillos 130 micrones Spin Klin 2" x 6 unidades PN10 (Arkal), o Azud 206/6FX PN10',
   'Por definir', null);

-- Sectores de riego (26)
insert into public.sector_riego (
  equipo_id, codigo, superficie_ha, lineas_por_hilera, caudal_emisor_lh,
  distancia_emisores_m, precipitacion_mmh, horas_turno, observaciones
)
select er.id, s.codigo, s.ha, s.lineas, s.caudal, s.dist, s.pp, s.horas, s.obs
from (values
  (1, '1-1', 4.06, 4, 4.0, 0.80, 2.86, 3.3, null),
  (1, '1-2', 4.63, 4, 4.0, 0.80, 2.86, 3.3, null),
  (1, '1-3', 5.01, 4, 4.0, 0.80, 2.86, 3.3, null),
  (1, '1-4', 4.53, 4, 4.0, 0.80, 2.86, 3.3, 'Plano indica 5,03 ha; se descuentan 0,50 ha por el tranque'),
  (1, '1-5', 5.12, 4, 4.0, 0.80, 2.86, 3.3, null),
  (1, '1-6', 5.12, 4, 4.0, 0.80, 2.86, 3.3, null),
  (2, '2-1', 2.21, 2, 2.0, 0.50, 2.00, 4.0, null),
  (2, '2-2', 2.21, 2, 2.0, 0.50, 2.00, 4.0, null),
  (2, '2-3', 2.21, 2, 2.0, 0.50, 2.00, 4.0, null),
  (2, '2-4', 2.65, 2, 2.0, 0.50, 2.00, 4.0, null),
  (2, '2-5', 2.64, 2, 2.0, 0.50, 2.00, 4.0, null),
  (3, '3-1', 2.62, 2, 2.0, 0.50, 2.00, 4.0, null),
  (3, '3-2', 2.62, 2, 2.0, 0.50, 2.00, 4.0, null),
  (3, '3-3', 2.62, 2, 2.0, 0.50, 2.00, 4.0, null),
  (3, '3-4', 2.60, 2, 2.0, 0.50, 2.00, 4.0, null),
  (3, '3-5', 2.60, 2, 2.0, 0.50, 2.00, 4.0, null),
  (4, '4-1', 3.04, 2, 2.0, 0.50, 2.00, 4.0, null),
  (4, '4-2', 4.06, 2, 2.0, 0.50, 2.00, 4.0, 'En el plano se divide en 4-2a (3,35 ha) y 4-2b (0,71 ha)'),
  (4, '4-3', 4.22, 2, 2.0, 0.50, 2.00, 4.0, null),
  (4, '4-4', 4.22, 2, 2.0, 0.50, 2.00, 4.0, 'Riega los cuarteles 4-4a (cerezo) y 4-4b (ciruelo)'),
  (4, '4-5', 4.21, 2, 2.0, 0.50, 2.00, 4.0, 'En el plano se divide en 4-5a (2,99 ha) y 4-5b (1,22 ha)'),
  (5, '5-1', 2.80, 2, 2.0, 0.50, 2.00, 4.0, null),
  (5, '5-2', 2.31, 2, 2.0, 0.50, 2.00, 4.0, null),
  (5, '5-3', 2.31, 2, 2.0, 0.50, 2.00, 4.0, null),
  (5, '5-4', 2.19, 2, 2.0, 0.50, 2.00, 4.0, null),
  (5, '5-5', 2.19, 2, 2.0, 0.50, 2.00, 4.0, null)
) as s(equipo, codigo, ha, lineas, caudal, dist, pp, horas, obs)
join public.equipo_riego er on er.numero = s.equipo;

-- Cuarteles (27) con su período vigente y su sector de riego
create temporary table _carga (
  codigo text, sector text, ha numeric, especie text, variedad text,
  dh numeric, dp numeric, estado public.estado_productivo, riego text, obs text
);

insert into _carga values
  ('1-1',  '1-1', 4.06, 'Nogal', 'Chandler', 7.0, 6.0, 'productivo', 'Goteo, 4 líneas por hilera', 'Nogal existente'),
  ('1-2',  '1-2', 4.63, 'Nogal', 'Chandler', 7.0, 5.0, 'productivo', 'Goteo, 4 líneas por hilera', 'Nogal existente'),
  ('1-3',  '1-3', 5.01, 'Nogal', 'Chandler', 7.0, 5.0, 'productivo', 'Goteo, 4 líneas por hilera', 'Nogal existente'),
  ('1-4',  '1-4', 4.53, 'Nogal', 'Chandler', 7.0, 5.0, 'productivo', 'Goteo, 4 líneas por hilera', 'Nogal existente. 0,50 ha menos por construcción del tranque'),
  ('1-5',  '1-5', 5.12, 'Nogal', 'Chandler', 7.0, 5.0, 'productivo', 'Goteo, 4 líneas por hilera', 'Nogal existente'),
  ('1-6',  '1-6', 5.12, 'Nogal', 'Chandler', 7.0, 5.0, 'productivo', 'Goteo, 4 líneas por hilera', 'Nogal existente'),
  ('2-1',  '2-1', 2.21, 'Cerezo', 'Lapins', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('2-2',  '2-2', 2.21, 'Cerezo', 'Lapins', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('2-3',  '2-3', 2.21, 'Cerezo', 'Lapins', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('2-4',  '2-4', 2.65, 'Durazno', 'Soledora', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('2-5',  '2-5', 2.64, 'Durazno', 'Soledora', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('3-1',  '3-1', 2.62, 'Nectarín', 'Tiffany', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('3-2',  '3-2', 2.62, 'Nectarín', 'Tiffany', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('3-3',  '3-3', 2.62, 'Nectarín', 'Luciana', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('3-4',  '3-4', 2.60, 'Nectarín', 'Luciana', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('3-5',  '3-5', 2.60, 'Cerezo', 'Areko', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('4-1',  '4-1', 3.04, 'Cerezo', 'Areko', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('4-2',  '4-2', 4.06, 'Cerezo', 'Areko', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', 'En el plano: 4-2a (3,35 ha) y 4-2b (0,71 ha)'),
  ('4-3',  '4-3', 4.22, 'Cerezo', 'Santina', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('4-4a', '4-4', 0.82, 'Cerezo', 'Santina', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('4-4b', '4-4', 3.40, 'Ciruelo', null, 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', 'Variedad pendiente: el plano solo indica "Ciruelo"'),
  ('4-5',  '4-5', 4.21, 'Ciruelo', 'AG 206', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', 'En el plano: 4-5a (2,99 ha) y 4-5b (1,22 ha)'),
  ('5-1',  '5-1', 2.80, 'Nectarín', 'Garcica', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('5-2',  '5-2', 2.31, 'Ciruelo', 'Red Phoenix', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('5-3',  '5-3', 2.31, 'Ciruelo', 'Red Phoenix', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('5-4',  '5-4', 2.19, 'Ciruelo', 'Candy Red', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null),
  ('5-5',  '5-5', 2.19, 'Ciruelo', 'Candy Red', 4.0, 2.0, 'en_formacion', 'Goteo, doble línea', null);

insert into public.cuartel (codigo, superficie_ha, estado_productivo, sistema_riego, observaciones)
select codigo, ha, estado, riego, obs from _carga;

insert into public.cuartel_sector (cuartel_id, sector_id)
select c.id, s.id
from _carga k
join public.cuartel c on c.codigo = k.codigo
join public.sector_riego s on s.codigo = k.sector;

insert into public.cuartel_periodo (
  cuartel_id, especie_id, variedad_id, distancia_hileras_m, distancia_plantas_m, motivo
)
select c.id, e.id, v.id, k.dh, k.dp, 'Carga inicial desde plano de sectorización v2'
from _carga k
join public.cuartel c on c.codigo = k.codigo
join public.especie e on e.nombre = k.especie
left join public.variedad v on v.especie_id = e.id and v.nombre = k.variedad;

-- Centros de costo generales (los de cada cuartel se crean solos)
insert into public.centro_costo (codigo, nombre, tipo) values
  ('ADM', 'Administración general', 'general'),
  ('MAQ', 'Maquinaria y vehículos', 'general'),
  ('RIE', 'Riego y caseta', 'general'),
  ('INF', 'Caminos, construcciones e infraestructura', 'general');

drop table _carga;
