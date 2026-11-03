"use server";
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { enviarAvisos } from "@/lib/push";
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

type Suscripcion = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Guarda este celular para recibir avisos */
export async function guardarSuscripcion(sub: Suscripcion, agente: string): Promise<EstadoFormulario> {
  const { supabase, user } = await obtenerSesion();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "No se pudo activar este celular." };
  const { error } = await supabase.from("push_suscripcion").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, agente: String(agente ?? "").slice(0, 200) },
    { onConflict: "endpoint" },
  );
  if (error) return { error: "No se pudo guardar este celular." };
  return { ok: "Avisos activados en este celular." };
}

export async function quitarSuscripcion(endpoint: string): Promise<EstadoFormulario> {
  const { supabase, user } = await obtenerSesion();
  await supabase.from("push_suscripcion").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  return { ok: "Avisos desactivados en este celular." };
}

/** Manda un aviso de prueba a todos los celulares activados de quien lo pide */
export async function enviarPrueba(): Promise<EstadoFormulario> {
  try {
    const { user } = await obtenerSesion();
    const r = await enviarAvisos(crearClienteAdmin(), [user.id], { title: "Agrícola BAS", body: "Prueba de aviso: si lo ves, las notificaciones funcionan.", url: "/" });
    if (r.celulares === 0) return { error: "El servidor no tiene este celular guardado. Desactiva y vuelve a activar los avisos." };
    if (r.enviados === 0) return { error: `El servicio de avisos del celular rechazó el envío (${r.errores[0] ?? "sin detalle"}). Desactiva y vuelve a activar los avisos; si se repite, avísale al administrador de la app con este texto.` };
    return { ok: `Aviso enviado a ${r.enviados} ${r.enviados === 1 ? "celular" : "celulares"}. Debería llegar en unos segundos.` };
  } catch (e: any) {
    return { error: `No se pudo enviar la prueba: ${String(e?.message ?? e).slice(0, 200)}` };
  }
}

/** ¿El servidor tiene guardado este celular? (para no mostrar "activado" si no quedó registrado) */
export async function celularRegistrado(endpoint: string): Promise<boolean> {
  const { supabase, user } = await obtenerSesion();
  const { data } = await supabase.from("push_suscripcion").select("id").eq("endpoint", endpoint).eq("user_id", user.id).maybeSingle();
  return !!data;
}
