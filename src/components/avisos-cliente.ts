"use client";
// Lógica del navegador para los avisos al celular (notificaciones push).
import { guardarSuscripcion, quitarSuscripcion, celularRegistrado } from "@/app/(app)/cuenta/acciones";

export type EstadoAvisos = "no_soportado" | "falta_instalar" | "bloqueado" | "apagado" | "activo";

const aBytes = (base64url: string) => {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

export async function leerEstadoAvisos(): Promise<EstadoAvisos> {
  const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const esIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  if (!soporta) return esIphone && !instalada ? "falta_instalar" : "no_soportado";
  if (Notification.permission === "denied") return "bloqueado";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub && Notification.permission === "granted" && (await celularRegistrado(sub.endpoint))) return "activo";
  } catch {
    /* sigue como apagado */
  }
  return "apagado";
}

/** Pide permiso (si hace falta) y registra este celular. Debe llamarse desde un toque del usuario la primera vez. */
export async function activarAvisos(clave: string | null): Promise<{ ok?: string; error?: string }> {
  try {
    if (!clave) return { error: "Los avisos todavía no están configurados en el servidor." };
    const permiso = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permiso !== "granted") return { error: "No diste permiso para los avisos." };
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(clave) });
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const r = await guardarSuscripcion({ endpoint: j.endpoint, keys: j.keys }, navigator.userAgent);
    return r ?? { error: "No se pudo guardar este celular." };
  } catch {
    return { error: "No se pudo activar. Cierra la app, ábrela de nuevo desde el ícono e intenta otra vez." };
  }
}

export async function desactivarAvisos(): Promise<{ ok?: string; error?: string }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await quitarSuscripcion(sub.endpoint);
      await sub.unsubscribe();
    }
    return { ok: "Avisos desactivados en este celular." };
  } catch {
    return { error: "No se pudo desactivar." };
  }
}
