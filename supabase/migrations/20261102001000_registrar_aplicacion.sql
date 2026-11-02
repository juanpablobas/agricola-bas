-- =====================================================================
-- Registrar una aplicación realizada y sus salidas de inventario en un solo paso.
-- Si algo falla (por ejemplo, falta stock) no se guarda nada.
-- Se ejecuta con los permisos de quien llama (las reglas de acceso siguen valiendo).
-- =====================================================================
create or replace function public.registrar_aplicacion(
  p_fecha     date,
  p_variedad  uuid,
  p_prog_app  uuid,
  p_titulo    text,
  p_litros    numeric,
  p_ha        numeric,
  p_obs       text,
  p_lineas    jsonb          -- [{"producto_id": "...", "cantidad": 12.5}, ...]
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id    uuid;
  v_ceco  uuid;
  r       record;
  v_stock numeric;
begin
  select id into v_ceco from ceco where variedad_id = p_variedad and activo limit 1;
  if v_ceco is null then
    raise exception 'Esa variedad no tiene centro de costo.';
  end if;

  -- Revisar stock por producto (varias líneas pueden usar el mismo producto)
  for r in
    select (x->>'producto_id')::uuid as producto_id, sum((x->>'cantidad')::numeric) as cant
    from jsonb_array_elements(p_lineas) x
    group by 1
  loop
    select stock into v_stock from v_stock where producto_id = r.producto_id;
    if v_stock is null or r.cant > v_stock + 0.0005 then
      raise exception 'No alcanza el stock de %: hay % y se piden %.',
        (select nombre from producto where id = r.producto_id), coalesce(v_stock, 0), r.cant;
    end if;
  end loop;

  insert into aplicacion_realizada (fecha, variedad_id, programa_aplicacion_id, titulo, litros_ha, ha, observacion, creado_por)
  values (p_fecha, p_variedad, p_prog_app, p_titulo, p_litros, p_ha, p_obs, auth.uid())
  returning id into v_id;

  insert into mov_inventario (tipo, origen, fecha, producto_id, cantidad, ceco_id, observacion, creado_por, aplicacion_id)
  select 'salida', 'manual', p_fecha, (x->>'producto_id')::uuid, (x->>'cantidad')::numeric, v_ceco,
         coalesce(p_titulo, 'Aplicación'), auth.uid(), v_id
  from jsonb_array_elements(p_lineas) x;

  return v_id;
end;
$$;

revoke all on function public.registrar_aplicacion(date, uuid, uuid, text, numeric, numeric, text, jsonb) from public, anon;
grant execute on function public.registrar_aplicacion(date, uuid, uuid, text, numeric, numeric, text, jsonb) to authenticated;
