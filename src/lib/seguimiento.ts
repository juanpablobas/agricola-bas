// Seguimiento de las aplicaciones de los programas: qué toca, qué está atrasado, qué se postergó.
import type { SupabaseClient } from "@supabase/supabase-js";
import { MESES_TEMPORADA } from "@/lib/programas";

/** Antes de este mes no se usaba la app: las aplicaciones de meses anteriores no se marcan como atrasadas. */
export const MES_INICIO_SEGUIMIENTO = 11;

export type Situacion = "atrasada" | "este_mes" | "reprogramada" | "proxima" | "omitida" | "ignorar";

export type Pendiente = {
  app_id: string;
  variedad_id: string;
  variedad: string;
  programa_id: string;
  programa: string;
  orden: number;
  titulo: string | null;
  mes: number | null;
  situacion: Situacion;
  motivo: string | null;
  nueva_fecha: string | null;
  estado: "postergada" | "omitida" | null;
};

const idx = (m: number | null) => (m ? MESES_TEMPORADA.indexOf(m) : -1);

export function situacionDe(mes: number | null, estado: { estado: string; nueva_fecha: string | null } | undefined, hoy: string): Situacion {
  if (estado?.estado === "omitida") return "omitida";
  if (estado?.estado === "postergada" && estado.nueva_fecha) return estado.nueva_fecha >= hoy ? "reprogramada" : "atrasada";
  if (!mes) return "ignorar";
  const mesActual = Number(hoy.slice(5, 7));
  if (idx(mes) < idx(MES_INICIO_SEGUIMIENTO)) return "ignorar";
  if (idx(mes) < idx(mesActual)) return "atrasada";
  if (idx(mes) === idx(mesActual)) return "este_mes";
  return "proxima";
}

/** Todas las aplicaciones por variedad que todavía no se registran, con su situación. */
export async function cargarSeguimiento(supabase: SupabaseClient, hoy: string) {
  const [{ data: programas }, { data: apps }, { data: pv }, { data: hechas }, { data: estados }] = await Promise.all([
    supabase.from("programa").select("id, nombre").eq("activo", true),
    supabase.from("programa_aplicacion").select("id, programa_id, orden, titulo, mes").range(0, 999),
    supabase.from("programa_variedad").select("programa_id, variedad_id, variedad(nombre)").range(0, 999),
    supabase.from("aplicacion_realizada").select("programa_aplicacion_id, variedad_id").range(0, 4999),
    supabase.from("aplicacion_estado").select("programa_aplicacion_id, variedad_id, estado, motivo, nueva_fecha").range(0, 4999),
  ]);
  const hecha = new Set((hechas ?? []).map((h: any) => `${h.programa_aplicacion_id}|${h.variedad_id}`));
  const est = new Map<string, any>((estados ?? []).map((e: any) => [`${e.programa_aplicacion_id}|${e.variedad_id}`, e]));
  const pendientes: Pendiente[] = [];
  for (const prog of (programas ?? []) as any[]) {
    const vars = ((pv ?? []) as any[]).filter((v) => v.programa_id === prog.id);
    for (const a of ((apps ?? []) as any[]).filter((x) => x.programa_id === prog.id)) {
      for (const v of vars) {
        const k = `${a.id}|${v.variedad_id}`;
        if (hecha.has(k)) continue;
        const e = est.get(k);
        pendientes.push({
          app_id: a.id, variedad_id: v.variedad_id, variedad: v.variedad?.nombre ?? "", programa_id: prog.id, programa: prog.nombre,
          orden: a.orden, titulo: a.titulo, mes: a.mes, situacion: situacionDe(a.mes, e, hoy),
          motivo: e?.motivo ?? null, nueva_fecha: e?.nueva_fecha ?? null, estado: e?.estado ?? null,
        });
      }
    }
  }
  const omitidas = new Set(pendientes.filter((p) => p.situacion === "omitida").map((p) => `${p.app_id}|${p.variedad_id}`));
  return { pendientes, omitidas };
}
