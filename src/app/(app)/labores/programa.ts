// Aplicaciones de los programas de los asesores, para mostrarlas en Labores como referencia (no son labores).
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarSeguimiento, type Situacion } from "@/lib/seguimiento";

export type AppPrograma = {
  app_id: string;
  programa_id: string;
  programa: string;
  orden: number;
  titulo: string;
  situacion: Exclude<Situacion, "omitida" | "ignorar">;
  variedades: { id: string; nombre: string }[];
  /** Día estimado (si el programa lo dice o se postergó a una fecha); si no, solo el mes */
  fecha: string | null;
  mesIso: string | null;
  aprox: string;
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const PRIORIDAD: AppPrograma["situacion"][] = ["atrasada", "reprogramada", "este_mes", "proxima"];
const sinTilde = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const dd = (n: number) => String(n).padStart(2, "0");

/** "20 de noviembre" → 20-11; "Mediados noviembre" → 15; "Fines…" → 25; "Inicio…" → 5 */
function estimarDia(texto: string, mes: number): { dia: number | null; mes: number; aprox: string } {
  const t = sinTilde(texto);
  const m = t.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
  if (m) {
    const mm = MESES.indexOf(m[2]) + 1;
    return { dia: Math.min(28, Number(m[1])), mes: mm, aprox: `≈ ${m[1]} de ${m[2]}` };
  }
  if (/\b(inicio|inicios|principio)/.test(t)) return { dia: 5, mes, aprox: `≈ inicio de ${MESES[mes - 1]}` };
  if (/\bmediados/.test(t)) return { dia: 15, mes, aprox: `≈ mediados de ${MESES[mes - 1]}` };
  if (/\b(fines|fin de|finales)/.test(t)) return { dia: 25, mes, aprox: `≈ fines de ${MESES[mes - 1]}` };
  return { dia: null, mes, aprox: `en ${MESES[mes - 1]}` };
}

export async function aplicacionesPrograma(supabase: SupabaseClient, hoy: string): Promise<AppPrograma[]> {
  const [{ pendientes }, { data: apps }] = await Promise.all([
    cargarSeguimiento(supabase, hoy),
    supabase.from("programa_aplicacion").select("id, fecha_estimada, estado_fenologico, titulo").range(0, 999),
  ]);
  const info = new Map(((apps ?? []) as any[]).map((a) => [a.id as string, a]));
  const anioHoy = Number(hoy.slice(0, 4));
  const inicioTemporada = Number(hoy.slice(5, 7)) >= 4 ? anioHoy : anioHoy - 1;
  const anioDe = (mes: number) => (mes >= 4 ? inicioTemporada : inicioTemporada + 1);

  const grupos = new Map<string, AppPrograma>();
  for (const p of pendientes) {
    if (p.situacion === "omitida" || p.situacion === "ignorar") continue;
    const a = info.get(p.app_id);
    const g = grupos.get(p.app_id);
    if (g) {
      g.variedades.push({ id: p.variedad_id, nombre: p.variedad });
      if (PRIORIDAD.indexOf(p.situacion) < PRIORIDAD.indexOf(g.situacion)) g.situacion = p.situacion;
      if (p.nueva_fecha && (!g.fecha || p.nueva_fecha < g.fecha)) { g.fecha = p.nueva_fecha; g.aprox = "postergada"; }
      continue;
    }
    let fecha: string | null = null;
    let mesIso: string | null = null;
    let aprox = "";
    if (p.nueva_fecha) {
      fecha = p.nueva_fecha;
      mesIso = p.nueva_fecha.slice(0, 7);
      aprox = "postergada";
    } else if (p.mes) {
      const e = estimarDia(`${a?.fecha_estimada ?? ""} ${a?.titulo ?? ""}`, p.mes);
      mesIso = `${anioDe(e.mes)}-${dd(e.mes)}`;
      fecha = e.dia ? `${mesIso}-${dd(e.dia)}` : null;
      aprox = e.aprox;
    }
    grupos.set(p.app_id, {
      app_id: p.app_id, programa_id: p.programa_id, programa: p.programa.split("(")[0].trim(), orden: p.orden,
      titulo: p.titulo || (a?.estado_fenologico ? `Aplicación ${p.orden} · ${String(a.estado_fenologico).toLowerCase()}` : `Aplicación ${p.orden}`),
      situacion: p.situacion, variedades: [{ id: p.variedad_id, nombre: p.variedad }], fecha, mesIso, aprox,
    });
  }
  return [...grupos.values()].sort((x, y) => (x.fecha ?? `${x.mesIso}-99`).localeCompare(y.fecha ?? `${y.mesIso}-99`) || x.orden - y.orden);
}

export const SITUACION_APP: Record<AppPrograma["situacion"], { texto: string; clase: string }> = {
  atrasada: { texto: "Atrasada", clase: "bg-alerta-claro text-alerta" },
  reprogramada: { texto: "Postergada", clase: "bg-[#efe6f7] text-[#6b3fa0]" },
  este_mes: { texto: "Toca este mes", clase: "bg-ambar-claro text-ambar" },
  proxima: { texto: "Próxima", clase: "bg-white text-tinta-suave ring-1 ring-linea" },
};
