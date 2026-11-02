"use server";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { EstadoFormulario } from "@/components/Aviso";

export async function ingresar(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const clave = String(form.get("clave") ?? "");
  if (!email || !clave) return { error: "Ingresa tu correo y contraseña." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: clave });
  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect("/");
}

export async function recuperarClave(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Escribe tu correo para enviarte el enlace." };
  const supabase = await crearClienteServidor();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/cuenta`,
  });
  // Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados.
  return { ok: "Si el correo está registrado, te llegará un enlace para crear una nueva contraseña." };
}
