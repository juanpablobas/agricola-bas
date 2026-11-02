-- =====================================================================
-- Riego: datos de diseño tomados de las memorias de cálculo (Equipos 2 a 5,
-- versión 1 del 20-08-2024). Cada "turno" de la memoria corresponde a un sector
-- del plano de sectorización (p. ej. turno 4 del Equipo 4 = sector 4-4); un sector
-- puede reunir más de un bloque de diseño (se riegan juntos).
-- =====================================================================
alter table public.equipo_riego
  add column caudal_diseno_m3h numeric(8,2),   -- mayor caudal de los turnos
  add column presion_diseno_m  numeric(6,1),   -- mayor presión requerida en la bomba
  add column largo_goteo_m     numeric(12,1),
  add column largo_matriz_m    numeric(10,1),  -- tubería PVC (matrices y secundarias)
  add column fuente_diseno     text;

alter table public.sector_riego
  add column caudal_diseno_m3h    numeric(8,2),
  add column presion_bomba_m      numeric(6,1),
  add column perdida_filtro_m     numeric(6,1),
  add column plantas              int,
  add column hileras              int,
  add column emisores             int,
  add column superficie_diseno_ha numeric(9,3);

create table public.bloque_riego (
  id                 uuid primary key default gen_random_uuid(),
  sector_id          uuid not null references public.sector_riego (id) on delete cascade,
  bloque             int  not null,
  cultivo            text,
  plantas            int,
  marco_plantas      text,
  marco_riego        text,
  superficie_ha      numeric(9,3),
  hileras            int,
  emisores           int,
  presion_valvula_m  numeric(6,1),
  caudal_diseno_m3h  numeric(8,3),
  unique (sector_id, bloque)
);

alter table public.bloque_riego enable row level security;
create policy bloque_riego_ver    on public.bloque_riego for select using (public.es_usuario_activo());
create policy bloque_riego_crear  on public.bloque_riego for insert with check (public.tiene_rol('administrador', 'enc_agricola'));
create policy bloque_riego_editar on public.bloque_riego for update
  using (public.tiene_rol('administrador', 'enc_agricola')) with check (public.tiene_rol('administrador', 'enc_agricola'));
create policy bloque_riego_borrar on public.bloque_riego for delete using (public.tiene_rol('administrador'));
create trigger auditar after insert or update or delete on public.bloque_riego
  for each row execute function public.registrar_auditoria();

update public.equipo_riego set caudal_diseno_m3h=53.0, presion_diseno_m=33.0, largo_goteo_m=60648.7, largo_matriz_m=917.65, fuente_diseno='Memoria de cálculo Equipo 2, versión 1 (20-08-2024)' where numero=2;
update public.sector_riego set caudal_diseno_m3h=45.9, presion_bomba_m=33.0, perdida_filtro_m=10.0, plantas=2762, hileras=56, emisores=22546, superficie_diseno_ha=2.209 where codigo='2-1';
update public.sector_riego set caudal_diseno_m3h=45.8, presion_bomba_m=33.0, perdida_filtro_m=10.0, plantas=2762, hileras=35, emisores=22542, superficie_diseno_ha=2.209 where codigo='2-2';
update public.sector_riego set caudal_diseno_m3h=46.4, presion_bomba_m=33.0, perdida_filtro_m=10.0, plantas=2762, hileras=33, emisores=22550, superficie_diseno_ha=2.21 where codigo='2-3';
update public.sector_riego set caudal_diseno_m3h=52.5, presion_bomba_m=32.0, perdida_filtro_m=10.0, plantas=3162, hileras=70, emisores=25812, superficie_diseno_ha=2.53 where codigo='2-4';
update public.sector_riego set caudal_diseno_m3h=53.0, presion_bomba_m=32.0, perdida_filtro_m=10.0, plantas=3162, hileras=33, emisores=25816, superficie_diseno_ha=2.53 where codigo='2-5';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,1,'Cerezo',2762,'4.00 x 2.00 m','3.92 x 0.50 m',2.209,56,22546,13.0,45.876 from public.sector_riego where codigo='2-1';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,2,'Cerezo',2762,'4.00 x 2.00 m','3.92 x 0.50 m',2.209,35,22542,13.0,45.76 from public.sector_riego where codigo='2-2';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,3,'Cerezo',2762,'4.00 x 2.00 m','3.92 x 0.50 m',2.21,33,22550,13.0,46.408 from public.sector_riego where codigo='2-3';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,4,'Cerezo',3162,'4.00 x 2.00 m','3.92 x 0.50 m',2.53,70,25812,14.0,52.488 from public.sector_riego where codigo='2-4';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,5,'Cerezo',3162,'4.00 x 2.00 m','3.92 x 0.50 m',2.53,33,25816,15.0,53.012 from public.sector_riego where codigo='2-5';
update public.equipo_riego set caudal_diseno_m3h=51.6, presion_diseno_m=33.0, largo_goteo_m=63043.84, largo_matriz_m=1125.58, fuente_diseno='Memoria de cálculo Equipo 3, versión 1 (20-08-2024)' where numero=3;
update public.sector_riego set caudal_diseno_m3h=50.7, presion_bomba_m=33.0, perdida_filtro_m=10.0, plantas=3060, hileras=39, emisores=24976, superficie_diseno_ha=2.448 where codigo='3-1';
update public.sector_riego set caudal_diseno_m3h=50.0, presion_bomba_m=33.0, perdida_filtro_m=10.0, plantas=3051, hileras=29, emisores=24906, superficie_diseno_ha=2.441 where codigo='3-2';
update public.sector_riego set caudal_diseno_m3h=50.5, presion_bomba_m=33.0, perdida_filtro_m=10.0, plantas=3055, hileras=43, emisores=24936, superficie_diseno_ha=2.444 where codigo='3-3';
update public.sector_riego set caudal_diseno_m3h=50.2, presion_bomba_m=33.0, perdida_filtro_m=10.0, plantas=3058, hileras=92, emisores=24964, superficie_diseno_ha=2.446 where codigo='3-4';
update public.sector_riego set caudal_diseno_m3h=51.6, presion_bomba_m=33.0, perdida_filtro_m=10.0, plantas=3261, hileras=36, emisores=26618, superficie_diseno_ha=2.609 where codigo='3-5';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,1,'Nectarín',3060,'4.00 x 2.00 m','3.92 x 0.50 m',2.448,39,24976,16.0,50.652 from public.sector_riego where codigo='3-1';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,2,'Nectarín',3051,'4.00 x 2.00 m','3.92 x 0.50 m',2.441,29,24906,20.0,49.988 from public.sector_riego where codigo='3-2';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,3,'Nectarín',3055,'4.00 x 2.00 m','3.92 x 0.50 m',2.444,43,24936,15.0,50.46 from public.sector_riego where codigo='3-3';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,4,'Nectarín',1629,'4.00 x 2.00 m','3.92 x 0.50 m',1.303,34,13296,13.0,26.524 from public.sector_riego where codigo='3-4';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,5,'Nectarín',1429,'4.00 x 2.00 m','3.92 x 0.50 m',1.143,58,11668,14.0,23.724 from public.sector_riego where codigo='3-4';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,6,'Cerezo',3261,'4.00 x 2.00 m','3.92 x 0.50 m',2.609,36,26618,16.0,51.588 from public.sector_riego where codigo='3-5';
update public.equipo_riego set caudal_diseno_m3h=85.9, presion_diseno_m=44.0, largo_goteo_m=100042.2, largo_matriz_m=1515.7, fuente_diseno='Memoria de cálculo Equipo 4, versión 1 (20-08-2024)' where numero=4;
update public.sector_riego set caudal_diseno_m3h=61.5, presion_bomba_m=33.0, perdida_filtro_m=10.0, plantas=3735, hileras=69, emisores=30492, superficie_diseno_ha=2.988 where codigo='4-1';
update public.sector_riego set caudal_diseno_m3h=82.7, presion_bomba_m=31.0, perdida_filtro_m=10.0, plantas=5077, hileras=100, emisores=41450, superficie_diseno_ha=4.062 where codigo='4-2';
update public.sector_riego set caudal_diseno_m3h=85.6, presion_bomba_m=31.0, perdida_filtro_m=10.0, plantas=5170, hileras=58, emisores=42206, superficie_diseno_ha=4.136 where codigo='4-3';
update public.sector_riego set caudal_diseno_m3h=85.8, presion_bomba_m=44.0, perdida_filtro_m=10.0, plantas=5165, hileras=58, emisores=42164, superficie_diseno_ha=4.132 where codigo='4-4';
update public.sector_riego set caudal_diseno_m3h=85.9, presion_bomba_m=44.0, perdida_filtro_m=10.0, plantas=5170, hileras=95, emisores=42206, superficie_diseno_ha=4.136 where codigo='4-5';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,1,'Cerezo',3735,'4.00 x 2.00 m','3.92 x 0.50 m',2.988,69,30492,12.0,61.46 from public.sector_riego where codigo='4-1';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,2,'Cerezo',4186,'4.00 x 2.00 m','3.92 x 0.50 m',3.349,70,34174,14.0,68.14 from public.sector_riego where codigo='4-2';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,3,'Cerezo',891,'4.00 x 2.00 m','3.92 x 0.50 m',0.713,30,7276,13.0,14.56 from public.sector_riego where codigo='4-2';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,4,'Cerezo',5170,'4.00 x 2.00 m','3.92 x 0.50 m',4.136,58,42206,15.0,85.636 from public.sector_riego where codigo='4-3';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,5,'Cerezo',1069,'4.00 x 2.00 m','3.92 x 0.50 m',0.855,13,8730,14.0,18.428 from public.sector_riego where codigo='4-4';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,6,'Cerezo',4096,'4.00 x 2.00 m','3.92 x 0.50 m',3.277,45,33434,13.0,67.384 from public.sector_riego where codigo='4-4';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,7,'Cerezo',3635,'4.00 x 2.00 m','3.92 x 0.50 m',2.908,51,29674,14.0,60.232 from public.sector_riego where codigo='4-5';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,8,'Cerezo',1535,'4.00 x 2.00 m','3.92 x 0.50 m',1.228,44,12532,12.0,25.696 from public.sector_riego where codigo='4-5';
update public.equipo_riego set caudal_diseno_m3h=59.7, presion_diseno_m=57.0, largo_goteo_m=61300.18, largo_matriz_m=866.73, fuente_diseno='Memoria de cálculo Equipo 5, versión 1 (20-08-2024)' where numero=5;
update public.sector_riego set caudal_diseno_m3h=59.7, presion_bomba_m=32.0, perdida_filtro_m=10.0, plantas=3645, hileras=62, emisores=29756, superficie_diseno_ha=2.916 where codigo='5-1';
update public.sector_riego set caudal_diseno_m3h=48.4, presion_bomba_m=45.0, perdida_filtro_m=10.0, plantas=2919, hileras=32, emisores=23826, superficie_diseno_ha=2.335 where codigo='5-2';
update public.sector_riego set caudal_diseno_m3h=48.7, presion_bomba_m=45.0, perdida_filtro_m=10.0, plantas=2918, hileras=31, emisores=23824, superficie_diseno_ha=2.335 where codigo='5-3';
update public.sector_riego set caudal_diseno_m3h=44.0, presion_bomba_m=46.0, perdida_filtro_m=10.0, plantas=2761, hileras=28, emisores=22542, superficie_diseno_ha=2.209 where codigo='5-4';
update public.sector_riego set caudal_diseno_m3h=45.1, presion_bomba_m=57.0, perdida_filtro_m=10.0, plantas=2762, hileras=33, emisores=22548, superficie_diseno_ha=2.21 where codigo='5-5';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,1,'Ciruelo',3645,'4.00 x 2.00 m','3.92 x 0.50 m',2.916,62,29756,14.0,59.744 from public.sector_riego where codigo='5-1';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,2,'Ciruelo',2919,'4.00 x 2.00 m','3.92 x 0.50 m',2.335,32,23826,14.0,48.388 from public.sector_riego where codigo='5-2';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,3,'Ciruelo',2918,'4.00 x 2.00 m','3.92 x 0.50 m',2.335,31,23824,14.0,48.748 from public.sector_riego where codigo='5-3';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,4,'Ciruelo',2761,'4.00 x 2.00 m','3.92 x 0.50 m',2.209,28,22542,13.0,43.988 from public.sector_riego where codigo='5-4';
insert into public.bloque_riego (sector_id,bloque,cultivo,plantas,marco_plantas,marco_riego,superficie_ha,hileras,emisores,presion_valvula_m,caudal_diseno_m3h) select id,5,'Ciruelo',2762,'4.00 x 2.00 m','3.92 x 0.50 m',2.21,33,22548,14.0,45.108 from public.sector_riego where codigo='5-5';
