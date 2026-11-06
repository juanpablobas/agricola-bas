import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Rol } from "@/lib/etiquetas";

export type Perfil = {
  id: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  activo: boolean;
};

/** Usuario conectado y su perfil. Redirige al ingreso si no hay sesión o el perfil está inactivo. */
export const obtenerSesion = cache(async function obtenerSesion() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfil")
    .select("id, nombre, email, rol, activo")
    .eq("id", user.id)
    .single<Perfil>();

  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut();
    redirect("/login?error=inactivo");
  }
  return { supabase, user, perfil };
});

/** Igual que obtenerSesion, pero exige uno de los roles indicados. */
export async function exigirRol(...roles: Rol[]) {
  const sesion = await obtenerSesion();
  if (!roles.includes(sesion.perfil.rol)) redirect("/?error=permiso");
  return sesion;
}

export function puede(rol: Rol, ...roles: Rol[]) {
  return roles.includes(rol);
}
