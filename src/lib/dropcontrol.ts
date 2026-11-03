// Conexión de solo lectura con Drop Control (Wiseconn). La clave va en la variable DROPCONTROL_API_KEY de Vercel.
const BASE = process.env.DROPCONTROL_API_URL || "https://api.wiseconn.com";

export const hayClaveDropControl = () => !!process.env.DROPCONTROL_API_KEY;

export type RespuestaDC<T = any> = { ok: boolean; estado: number; datos?: T; error?: string };

export async function dcGet<T = any>(ruta: string): Promise<RespuestaDC<T>> {
  const clave = process.env.DROPCONTROL_API_KEY;
  if (!clave) return { ok: false, estado: 0, error: "Falta la clave (DROPCONTROL_API_KEY) en Vercel." };
  try {
    const r = await fetch(`${BASE}${ruta}`, {
      headers: { api_key: clave, accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    const texto = await r.text();
    let datos: any = null;
    try { datos = texto ? JSON.parse(texto) : null; } catch { /* no es JSON */ }
    if (!r.ok) return { ok: false, estado: r.status, error: (datos && (datos.message || datos.error)) || texto.slice(0, 200) || `Respuesta ${r.status}` };
    return { ok: true, estado: r.status, datos };
  } catch (e) {
    return { ok: false, estado: 0, error: e instanceof Error ? e.message : "No se pudo conectar" };
  }
}
