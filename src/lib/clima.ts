// Pronóstico del tiempo (Open-Meteo, gratis y sin clave) y alertas simples para el trabajo del campo.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Dia = { fecha: string; tmin: number; tmax: number; lluvia: number; probLluvia: number | null; viento: number; rafaga: number; et0?: number | null };
export type Actual = { temp: number; humedad: number | null; viento: number; lluvia: number } | null;
export type Ubicacion = { lat: number; lng: number; origen: "campo" | "comuna"; nombre: string };
export type Alerta = { tipo: "helada" | "lluvia" | "viento" | "calor"; nivel: "alto" | "medio"; fecha: string; titulo: string; detalle: string };

/** Referencias generales; no reemplazan el criterio del asesor */
export const UMBRALES = { heladaAlta: 0, heladaMedia: 2, lluvia: 1, vientoMedio: 15, vientoAlto: 20, calor: 33 };

export async function ubicacionDelCampo(supabase: SupabaseClient): Promise<Ubicacion | null> {
  const { data: c } = await supabase.from("campo").select("nombre, comuna, latitud, longitud").limit(1).maybeSingle();
  if (c?.latitud != null && c?.longitud != null) return { lat: Number(c.latitud), lng: Number(c.longitud), origen: "campo", nombre: c.nombre ?? "Fundo" };
  const lugar = (c?.comuna as string | null) || "Graneros";
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(lugar)}&count=1&language=es&countryCode=CL`, { next: { revalidate: 86400 } });
    const j = await r.json();
    const p = j?.results?.[0];
    if (p) return { lat: p.latitude, lng: p.longitude, origen: "comuna", nombre: p.name ?? lugar };
  } catch {
    /* sin geocodificación */
  }
  return null;
}

export async function obtenerClima(u: Ubicacion): Promise<{ actual: Actual; dias: Dia[] } | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${u.lat}&longitude=${u.lng}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,et0_fao_evapotranspiration` +
    `&past_days=3&forecast_days=7&wind_speed_unit=kmh&timezone=America%2FSantiago`;
  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    if (!r.ok) return null;
    const j = await r.json();
    const d = j.daily;
    const dias: Dia[] = (d.time as string[]).map((fecha, i) => ({
      fecha,
      tmin: d.temperature_2m_min[i],
      tmax: d.temperature_2m_max[i],
      lluvia: d.precipitation_sum[i] ?? 0,
      probLluvia: d.precipitation_probability_max?.[i] ?? null,
      viento: d.wind_speed_10m_max[i] ?? 0,
      rafaga: d.wind_gusts_10m_max[i] ?? 0,
      et0: d.et0_fao_evapotranspiration?.[i] ?? null,
    }));
    const c = j.current;
    return { actual: c ? { temp: c.temperature_2m, humedad: c.relative_humidity_2m ?? null, viento: c.wind_speed_10m, lluvia: c.precipitation ?? 0 } : null, dias };
  } catch {
    return null;
  }
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const nombreDiaClima = (iso: string) => DIAS[new Date(iso + "T12:00:00Z").getUTCDay()];

/** Alertas para los días desde hoy en adelante */
export function alertasDe(dias: Dia[], hoy: string, hasta = 5): Alerta[] {
  const out: Alerta[] = [];
  for (const d of dias.filter((x) => x.fecha >= hoy).slice(0, hasta)) {
    const dia = nombreDiaClima(d.fecha);
    if (d.tmin <= UMBRALES.heladaMedia)
      out.push({ tipo: "helada", nivel: d.tmin <= UMBRALES.heladaAlta ? "alto" : "medio", fecha: d.fecha, titulo: `Riesgo de helada el ${dia}`, detalle: `Mínima de ${d.tmin.toFixed(1)} °C. Si hay flor o fruto recién cuajado, conviene tener listo el riego o los métodos de protección.` });
    if (d.lluvia >= UMBRALES.lluvia)
      out.push({ tipo: "lluvia", nivel: d.lluvia >= 5 ? "alto" : "medio", fecha: d.fecha, titulo: `Lluvia el ${dia}`, detalle: `Unos ${d.lluvia.toFixed(1)} mm${d.probLluvia != null ? ` (probabilidad ${d.probLluvia}%)` : ""}. No conviene aplicar fitosanitarios; si había una aplicación, posterga.` });
    if (d.viento >= UMBRALES.vientoMedio)
      out.push({ tipo: "viento", nivel: d.viento >= UMBRALES.vientoAlto ? "alto" : "medio", fecha: d.fecha, titulo: `Viento fuerte el ${dia}`, detalle: `Hasta ${Math.round(d.viento)} km/h (ráfagas de ${Math.round(d.rafaga)}). Evita pulverizar: el producto se desvía y se pierde.` });
    if (d.tmax >= UMBRALES.calor)
      out.push({ tipo: "calor", nivel: "medio", fecha: d.fecha, titulo: `Calor el ${dia}`, detalle: `Máxima de ${d.tmax.toFixed(0)} °C. Aplica temprano en la mañana y revisa que el riego alcance.` });
  }
  return out;
}

/** Días futuros buenos para pulverizar: sin lluvia y con poco viento */
export function diasBuenosParaAplicar(dias: Dia[], hoy: string, hasta = 5): Dia[] {
  return dias.filter((x) => x.fecha >= hoy).slice(0, hasta).filter((d) => d.lluvia < 0.3 && (d.probLluvia ?? 0) <= 30 && d.viento <= UMBRALES.vientoMedio && d.rafaga <= 25);
}
