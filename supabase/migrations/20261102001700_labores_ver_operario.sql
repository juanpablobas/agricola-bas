-- Los trabajadores con usuario (rol operario) pueden ver el plan y los registros de labores, sin montos.
do $$
declare t text;
begin
  foreach t in array array['cuadrilla', 'labor_tipo', 'labor_plan', 'labor_registro', 'trabajador'] loop
    execute format('create policy %I on public.%I for select using (public.tiene_rol(''operario''))', t || '_ver_operario', t);
  end loop;
end $$;
