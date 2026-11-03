// Recomendación diaria con IA: una vez al día, a partir de datos reales del campo. Si falta la clave, no hace nada.
import type { SupabaseClient } from "@supabase/supabase-js";
import { alertasDe, obtenerClima, ubicacionDelCampo, nombreDiaClima } from "@/lib/clima";
import { cargarSeguimiento } from "@/lib/seguimiento";
import { lunesDe } from "@/lib/semana";
import { NOMBRE_MES } from "@/lib/programas";

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export const hayClaveIA = () => !!process.env.ANTHROPIC_API_KEY;

async function armarContexto(admin: SupabaseClient, hoy: string) {
  const mes = Number(hoy.slice(5, 7));
  const partes: string[] = [`Fecha: ${nombreDiaClima(hoy)} ${hoy.slice(8, 10)}-${hoy.slice(5, 7)}-${hoy.slice(0, 4)} (hemisferio sur, mes de ${NOMBRE_MES[mes]}). Campo en Codegua/Graneros, zona central de Chile.`];

  const { data: cuarteles } = await admin.from("v_cuartel").select("especie, variedad, superficie_ha, estado_productivo").eq("activo", true).range(0, 999);
  const porEsp = new Map<string, number>();
  for (const c of (cuarteles ?? []) as any[]) porEsp.set(`${c.especie}${c.variedad ? ` ${c.variedad}` : ""}`, (porEsp.get(`${c.especie}${c.variedad ? ` ${c.variedad}` : ""}`) ?? 0) + Number(c.superficie_ha ?? 0));
  partes.push("Especies y variedades (ha): " + [...porEsp].map(([k, v]) => `${k} ${v.toFixed(1)}`).join("; "));

  const ub = await ubicacionDelCampo(admin);
  const cl = ub ? await obtenerClima(ub) : null;
  if (cl) {
    const futuros = cl.dias.filter((d) => d.fecha >= hoy).slice(0, 5);
    partes.push("Pronóstico (mín/máx °C, lluvia mm, viento máx km/h): " + futuros.map((d) => `${nombreDiaClima(d.fecha)} ${d.fecha.slice(8, 10)}: ${d.tmin.toFixed(0)}/${d.tmax.toFixed(0)}, ${d.lluvia.toFixed(1)} mm, ${Math.round(d.viento)} km/h`).join(" | "));
    const al = alertasDe(cl.dias, hoy, 5);
    if (al.length) partes.push("Alertas calculadas: " + al.map((a) => a.titulo).join("; "));
  } else partes.push("Pronóstico: no disponible hoy.");

  const { pendientes } = await cargarSeguimiento(admin, hoy);
  const grupos = new Map<string, { t: string; vars: string[]; sit: string; nueva: string | null }>();
  for (const x of pendientes.filter((p) => ["atrasada", "este_mes", "reprogramada"].includes(p.situacion))) {
    const g = grupos.get(x.app_id) ?? { t: `${x.programa}, aplicación ${x.orden}${x.titulo ? ` (${x.titulo})` : ""}`, vars: [], sit: x.situacion, nueva: x.nueva_fecha ?? null };
    g.vars.push(x.variedad);
    grupos.set(x.app_id, g);
  }
  partes.push(grupos.size ? "Aplicaciones por hacer: " + [...grupos.values()].slice(0, 14).map((g) => `${g.t} en ${g.vars.join(", ")} [${g.sit === "atrasada" ? "atrasada" : g.sit === "reprogramada" ? `reprogramada${g.nueva ? ` para ${g.nueva}` : ""}` : "toca este mes"}]`).join("; ") : "Aplicaciones por hacer: ninguna pendiente.");

  const lunes = lunesDe(hoy);
  const [{ data: plan }, { data: tipos }] = await Promise.all([
    admin.from("labor_plan").select("labor_tipo_id, estado").eq("semana", lunes),
    admin.from("labor_tipo").select("id, nombre"),
  ]);
  const nl = new Map(((tipos ?? []) as any[]).map((t) => [t.id, t.nombre as string]));
  const pend = ((plan ?? []) as any[]).filter((p) => p.estado === "pendiente").map((p) => nl.get(p.labor_tipo_id) ?? "Labor");
  partes.push(pend.length ? `Labores planificadas esta semana y pendientes: ${[...new Set(pend)].join(", ")}.` : "Labores planificadas esta semana: no hay labores pendientes cargadas.");
  return partes.join("\n");
}

const INSTRUCCIONES = `Eres un asistente agrícola que apoya al administrador de un campo frutal chileno (cerezos, ciruelos, nectarines, duraznos y nogales). Escribe en español de Chile, simple y directo.
Con los datos entregados, escribe la recomendación del día: de 3 a 5 puntos cortos, ordenados por prioridad, máximo 170 palabras en total.
Reglas estrictas:
- Usa solo los datos entregados. No inventes datos del campo (estados fenológicos, plagas observadas, stock, dosis).
- No recomiendes productos ni dosis nuevos: las aplicaciones las define el asesor. Puedes sugerir adelantar, postergar o agrupar aplicaciones y labores según clima.
- Si no hay nada relevante, dilo en una línea.
- Si algo depende de lo que se vea en terreno, dilo ("revisar en terreno").
- Sin saludos ni cierre. Cada punto empieza con "•".`;

export async function generarRecomendacion(admin: SupabaseClient, hoy: string): Promise<{ ok: boolean; texto?: string; error?: string; sinCredito?: boolean }> {
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) return { ok: false, error: "Falta la clave de la IA (ANTHROPIC_API_KEY) en Vercel." };
  try {
    const contexto = await armarContexto(admin, hoy);
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": clave, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODELO, max_tokens: 600, system: INSTRUCCIONES, messages: [{ role: "user", content: contexto }] }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detalle: string = j?.error?.message ?? "sin detalle";
      if (/credit balance|billing|credit/i.test(detalle) && (r.status === 400 || r.status === 402)) {
        return { ok: false, sinCredito: true, error: "La cuenta de la IA se quedó sin crédito. Carga saldo en la consola de Anthropic (Billing)." };
      }
      if (r.status === 401) return { ok: false, error: "La clave de la IA no es válida. Revisa ANTHROPIC_API_KEY en Vercel." };
      return { ok: false, error: `La IA respondió ${r.status}: ${detalle}` };
    }
    const texto = (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    if (!texto) return { ok: false, error: "La IA no devolvió texto." };
    const { error } = await admin.from("recomendacion_diaria").upsert({ fecha: hoy, texto, modelo: MODELO });
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
    return { ok: true, texto };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}
