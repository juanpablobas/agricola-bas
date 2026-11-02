import type { SupabaseClient } from "@supabase/supabase-js";

export type Op = { id: string; texto: string };

/** Listas para los formularios: cuarteles, labores y cuadrillas activas */
export async function cargarOpciones(supabase: SupabaseClient, incluir?: { cuadrilla?: string | null; labor?: string | null }) {
  const [{ data: cu }, { data: la }, { data: cd }] = await Promise.all([
    supabase.from("v_cuartel").select("id, codigo, especie, variedad").eq("activo", true).order("codigo").range(0, 999),
    supabase.from("labor_tipo").select("id, nombre, activo").order("nombre"),
    supabase.from("cuadrilla").select("id, nombre, jefe, activo").order("nombre"),
  ]);
  const etiquetaCuartel = (c: any) => `${c.codigo}${c.especie ? " · " + c.especie : ""}${c.variedad ? " " + c.variedad : ""}`;
  const cuarteles: Op[] = ((cu ?? []) as any[]).map((c) => ({ id: c.id, texto: etiquetaCuartel(c) }));
  const labores: Op[] = ((la ?? []) as any[]).filter((l) => l.activo || l.id === incluir?.labor).map((l) => ({ id: l.id, texto: l.nombre }));
  const cuadrillas: Op[] = ((cd ?? []) as any[]).filter((c) => c.activo || c.id === incluir?.cuadrilla).map((c) => ({ id: c.id, texto: c.jefe ? `${c.nombre} (${c.jefe})` : c.nombre }));
  return { cuarteles, labores, cuadrillas, nombres: {
    cuartel: new Map<string, string>(cuarteles.map((c) => [c.id, c.texto])),
    labor: new Map<string, string>(((la ?? []) as any[]).map((l) => [l.id, l.nombre])),
    cuadrilla: new Map<string, string>(((cd ?? []) as any[]).map((c) => [c.id, c.jefe ? `${c.nombre} (${c.jefe})` : c.nombre])),
  } };
}
