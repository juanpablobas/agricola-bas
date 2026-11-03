-- Ubicación del campo (para el clima). Si está vacía, se usa la comuna.
alter table public.campo add column latitud numeric(9, 6), add column longitud numeric(9, 6);
