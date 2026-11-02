-- =====================================================================
-- Ajustes de seguridad sugeridos por el revisor de Supabase
-- =====================================================================

-- 1. Ruta de búsqueda fija en todas las funciones
alter function public.tocar_actualizado_en() set search_path = public;
alter function public.proteger_ultimo_admin() set search_path = public;
alter function public.temporada_de(date) set search_path = public;
alter function public.validar_variedad_periodo() set search_path = public;
alter function public.auditoria_inmutable() set search_path = public;
alter function public.nuevo_periodo_cuartel(uuid, date, uuid, uuid, text, int, numeric, numeric, int, text) set search_path = public;

-- 2. Nadie sin sesión puede llamar funciones privilegiadas.
--    Las funciones de disparador no necesitan permiso de ejecución para dispararse.
revoke execute on function public.crear_perfil_nuevo_usuario() from public, anon, authenticated;
revoke execute on function public.registrar_auditoria() from public, anon, authenticated;
revoke execute on function public.crear_centro_costo_cuartel() from public, anon, authenticated;
revoke execute on function public.sincronizar_centro_costo_cuartel() from public, anon, authenticated;

revoke execute on function public.rol_actual() from public, anon;
revoke execute on function public.tiene_rol(public.rol_usuario[]) from public, anon;
revoke execute on function public.es_usuario_activo() from public, anon;
revoke execute on function public.actualizar_mi_nombre(text) from public, anon;
revoke execute on function public.nuevo_periodo_cuartel(uuid, date, uuid, uuid, text, int, numeric, numeric, int, text) from public, anon;

grant execute on function public.rol_actual() to authenticated;
grant execute on function public.tiene_rol(public.rol_usuario[]) to authenticated;
grant execute on function public.es_usuario_activo() to authenticated;
grant execute on function public.actualizar_mi_nombre(text) to authenticated;
grant execute on function public.nuevo_periodo_cuartel(uuid, date, uuid, uuid, text, int, numeric, numeric, int, text) to authenticated;

-- 3. Las vistas respetan los permisos de quien consulta.
--    Para mostrar nombres de quien sube un archivo o hace un cambio,
--    todo usuario activo puede ver el directorio de usuarios (nombre, correo, rol).
drop policy if exists perfil_ver on public.perfil;
create policy perfil_ver on public.perfil for select
  using (id = auth.uid() or public.es_usuario_activo());

alter view public.v_usuario set (security_invoker = true);
alter view public.v_actividad set (security_invoker = true);
