"use server";
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth";
import type { EstadoFormulario } from "@/components/Aviso";

export async function guardarNombre(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await obtenerSesion();
  const nombre = String(form.get("nombre") ?? "").trim();
  if (!nombre) return { error: "Escribe tu nombre." };
  const { error } = await supabase.rpc("actualizar_mi_nombre", { p_nombre: nombre });
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/", "layout");
  return { ok: "Nombre actualizado." };
}

export async function cambiarClave(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await obtenerSesion();
  const clave = String(form.get("clave") ?? "");
  const repetir = String(form.get("repetir") ?? "");
  if (clave.length < 10) return { error: "Usa al menos 10 caracteres." };
  if (clave !== repetir) return { error: "Las contraseñas no coinciden." };
  const { error } = await supabase.auth.updateUser({ password: clave });
  if (error) return { error: "No se pudo cambiar la contraseña. Si el enlace venció, pide uno nuevo." };
  return { ok: "Contraseña actualizada." };
}
