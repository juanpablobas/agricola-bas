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

/** "hace 12 min", "hace 3 h", "hace 2 días" */
export function hace(valor: unknown): { texto: string; minutos: number | null } {
  const t = typeof valor === "number" ? valor : Date.parse(String(valor ?? ""));
  if (!Number.isFinite(t)) return { texto: "sin hora", minutos: null };
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return { texto: "recién", minutos: min };
  if (min < 60) return { texto: `hace ${min} min`, minutos: min };
  if (min < 48 * 60) return { texto: `hace ${Math.round(min / 60)} h`, minutos: min };
  return { texto: `hace ${Math.round(min / 1440)} días`, minutos: min };
}

/** Saca pares (hora, valor) de una respuesta cuyo formato no conocemos del todo */
export function puntosDe(x: any): { t: number; v: number }[] {
  const lista: any[] = Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : Array.isArray(x?.values) ? x.values : [];
  const clavesT = ["time", "date", "dateTime", "datetime", "timestamp", "fecha", "t"];
  const clavesV = ["value", "valor", "data", "val", "v"];
  const out: { t: number; v: number }[] = [];
  for (const it of lista) {
    let t: number | null = null;
    let v: number | null = null;
    if (Array.isArray(it) && it.length >= 2) {
      t = typeof it[0] === "number" ? it[0] : Date.parse(String(it[0]));
      v = Number(it[1]);
    } else if (it && typeof it === "object") {
      const kt = clavesT.find((k) => it[k] != null);
      const kv = clavesV.find((k) => it[k] != null && Number.isFinite(Number(it[k])));
      if (kt) t = typeof it[kt] === "number" ? (it[kt] < 1e11 ? it[kt] * 1000 : it[kt]) : Date.parse(String(it[kt]));
      if (kv) v = Number(it[kv]);
    }
    if (t !== null && Number.isFinite(t) && v !== null && Number.isFinite(v)) out.push({ t, v });
  }
  return out.sort((a, b) => a.t - b.t);
}
