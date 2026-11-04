import type { SupabaseClient } from "@supabase/supabase-js";

export type Op = { id: string; texto: string };

/** Listas para los formularios: cuarteles, labores y cuadrillas activas */
export async function cargarOpciones(supabase: SupabaseClient, incluir?: { cuadrilla?: string | null; labor?: string | null; fiscalizador?: string | null }) {
  const [{ data: cu }, { data: la }, { data: cd }, { data: tr }] = await Promise.all([
    supabase.from("v_cuartel").select("id, codigo, especie, variedad, variedad_id, superficie_ha").eq("activo", true).order("codigo").range(0, 999),
    supabase.from("labor_tipo").select("id, nombre, activo").order("nombre"),
    supabase.from("cuadrilla").select("id, nombre, jefe, telefono, activo").order("nombre"),
    supabase.from("trabajador").select("id, nombre, vive_en_campo, telefono, activo").order("nombre"),
  ]);
  const etiquetaCuartel = (c: any) => `${c.codigo}${c.especie ? " · " + c.especie : ""}${c.variedad ? " " + c.variedad : ""}`;
  const cuarteles: Op[] = ((cu ?? []) as any[]).map((c) => ({ id: c.id, texto: etiquetaCuartel(c) }));
  // Variedades con dos o más cuarteles: se pueden elegir completas ("Santina completa: 2-3, 4-3, 4-4a")
  const porVar = new Map<string, { especie: string; variedad: string; codigos: string[]; ha: number }>();
  for (const c of (cu ?? []) as any[]) {
    if (!c.variedad_id) continue;
    const g = porVar.get(c.variedad_id) ?? { especie: c.especie ?? "", variedad: c.variedad ?? "", codigos: [], ha: 0 };
    g.codigos.push(c.codigo);
    g.ha += Number(c.superficie_ha ?? 0);
    porVar.set(c.variedad_id, g);
  }
  const nombreVariedad = new Map<string, string>([...porVar].map(([id, g]) => [id, `${g.variedad} completa (${g.codigos.join(", ")})`]));
  const variedades: Op[] = [...porVar]
    .filter(([, g]) => g.codigos.length >= 2)
    .sort((a, b) => (a[1].especie + a[1].variedad).localeCompare(b[1].especie + b[1].variedad, "es"))
    .map(([id, g]) => ({ id: `v:${id}`, texto: `${g.especie} ${g.variedad} completa · ${g.codigos.join(", ")} · ${g.ha.toLocaleString("es-CL", { maximumFractionDigits: 1 })} ha` }));
  const labores: Op[] = ((la ?? []) as any[]).filter((l) => l.activo || l.id === incluir?.labor).map((l) => ({ id: l.id, texto: l.nombre }));
  const cuadrillas: Op[] = ((cd ?? []) as any[]).filter((c) => c.activo || c.id === incluir?.cuadrilla).map((c) => ({ id: c.id, texto: c.jefe ? `${c.nombre} (${c.jefe})` : c.nombre }));
  const trabajadores: Op[] = ((tr ?? []) as any[]).filter((t) => t.activo || t.id === incluir?.fiscalizador).map((t) => ({ id: t.id, texto: t.nombre }));
  const nombreCuartel = new Map<string, string>(cuarteles.map((c) => [c.id, c.texto]));
  /** Dónde se hizo: un cuartel, una variedad completa o el campo en general */
  const donde = (x: { cuartel_id?: string | null; variedad_id?: string | null }) =>
    x.cuartel_id ? nombreCuartel.get(x.cuartel_id) ?? "Cuartel" : x.variedad_id ? nombreVariedad.get(x.variedad_id) ?? "Variedad completa" : "General del campo";
  return { cuarteles, variedades, donde, labores, cuadrillas, trabajadores,
    telefonos: {
      trabajador: new Map<string, string | null>(((tr ?? []) as any[]).map((t) => [t.id, t.telefono])),
      cuadrilla: new Map<string, string | null>(((cd ?? []) as any[]).map((c) => [c.id, c.telefono])),
    },
    nombres: {
    trabajador: new Map<string, string>(((tr ?? []) as any[]).map((t) => [t.id, t.nombre])),
    cuartel: new Map<string, string>(cuarteles.map((c) => [c.id, c.texto])),
    labor: new Map<string, string>(((la ?? []) as any[]).map((l) => [l.id, l.nombre])),
    cuadrilla: new Map<string, string>(((cd ?? []) as any[]).map((c) => [c.id, c.jefe ? `${c.nombre} (${c.jefe})` : c.nombre])),
  } };
}
