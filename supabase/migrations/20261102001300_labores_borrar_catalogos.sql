-- Permitir borrar trabajadores, cuadrillas y labores (las que ya se usaron no se pueden borrar: se desactivan).
create policy trabajador_borrar on public.trabajador for delete
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy cuadrilla_borrar on public.cuadrilla for delete
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
create policy labor_tipo_borrar on public.labor_tipo for delete
  using (public.tiene_rol('administrador', 'enc_administrativo', 'enc_agricola'));
