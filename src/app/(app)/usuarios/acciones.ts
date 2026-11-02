"use server";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { leerTexto } from "@/lib/formato";
import { ROLES, type Rol } from "@/lib/etiquetas";

export type EstadoInvitacion = { error?: string; ok?: string; clave?: string; email?: string } | null;

function claveTemporal() {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 12 }, () => letras[randomInt(letras.length)]).join("");
}

export async function crearUsuario(_: EstadoInvitacion, form: FormData): Promise<EstadoInvitacion> {
  await exigirRol("administrador");
  const email = leerTexto(form.get("email"))?.toLowerCase();
  const nombre = leerTexto(form.get("nombre")) ?? "";
  const rol = String(form.get("rol")) as Rol;
  const metodo = String(form.get("metodo") ?? "clave");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Escribe un correo válido." };
  if (!ROLES.some((r) => r.valor === rol)) return { error: "Elige un rol." };

  const admin = crearClienteAdmin();
  let userId: string | undefined;
  let clave: string | undefined;

  if (metodo === "correo") {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nombre },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/cuenta`,
    });
    if (error) {
      return {
        error: error.message.includes("already")
          ? "Ese correo ya tiene una cuenta."
          : "No se pudo enviar la invitación. Revisa la configuración de correo de Supabase o usa contraseña temporal.",
      };
    }
    userId = data.user?.id;
  } else {
    clave = claveTemporal();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: clave,
      email_confirm: true,
      user_metadata: { nombre },
    });
    if (error) return { error: error.message.includes("already") ? "Ese correo ya tiene una cuenta." : "No se pudo crear el usuario." };
    userId = data.user?.id;
  }

  if (userId) await admin.from("perfil").update({ rol, nombre }).eq("id", userId);
  revalidatePath("/usuarios");
  return metodo === "correo"
    ? { ok: `Invitación enviada a ${email}.` }
    : { ok: "Usuario creado. Entrégale estos datos; podrá cambiar la contraseña en Mi cuenta.", clave, email };
}

export async function cambiarRol(form: FormData) {
  const { supabase } = await exigirRol("administrador");
  const id = String(form.get("id"));
  const rol = String(form.get("rol")) as Rol;
  if (!ROLES.some((r) => r.valor === rol)) return;
  await supabase.from("perfil").update({ rol }).eq("id", id);
  revalidatePath("/usuarios");
}

export async function cambiarEstadoUsuario(form: FormData) {
  const { supabase, user } = await exigirRol("administrador");
  const id = String(form.get("id"));
  if (id === user.id) return; // nadie se desactiva a sí mismo
  const activo = form.get("activo") === "true";
  await supabase.from("perfil").update({ activo }).eq("id", id);
  revalidatePath("/usuarios");
}
