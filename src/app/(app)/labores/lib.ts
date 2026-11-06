import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIAS } from "./modelo";

export type Op = { id: string; texto: string };
/** Opción con datos extra para el formulario (especie para filtrar labores, hectáreas, tipo de cuadrilla, categoría) */
export type OpX = Op & { especie?: string | null; ha?: number; tipo?: string; rut?: string | null; categoria?: string; especies?: string[] | null };

/** Listas para los formularios y nombres para mostrar */
export async function cargarOpciones(supabase: SupabaseClient, incluir?: { cuadrilla?: string | null; labor?: string | null; fiscalizador?: string | null }) {
  const [{ data: cu }, { data: la }, { data: cd }, { data: tr }] = await Promise.all([
    supabase.from("v_cuartel").select("id, codigo, especie, especie_id, variedad, variedad_id, superficie_ha").eq("activo", true).order("codigo").range(0, 999),
    supabase.from("labor_tipo").select("id, nombre, activo, categoria, especies").order("nombre"),
    supabase.from("cuadrilla").select("id, nombre, jefe, telefono, activo, tipo, rut").order("nombre"),
    supabase.from("trabajador").select("id, nombre, vive_en_campo, telefono, activo").order("nombre"),
  ]);
  const etiquetaCuartel = (c: any) => `${c.codigo}${c.especie ? " · " + c.especie : ""}${c.variedad ? " " + c.variedad : ""}`;
  const cuarteles: OpX[] = ((cu ?? []) as any[]).map((c) => ({ id: c.id, texto: etiquetaCuartel(c), especie: c.especie_id ?? null, ha: Number(c.superficie_ha ?? 0) }));
  // Variedades con dos o más cuarteles: se pueden elegir completas
  const porVar = new Map<string, { especie: string; especieId: string | null; variedad: string; codigos: string[]; ha: number }>();
  for (const c of (cu ?? []) as any[]) {
    if (!c.variedad_id) continue;
    const g = porVar.get(c.variedad_id) ?? { especie: c.especie ?? "", especieId: c.especie_id ?? null, variedad: c.variedad ?? "", codigos: [], ha: 0 };
    g.codigos.push(c.codigo);
    g.ha += Number(c.superficie_ha ?? 0);
    porVar.set(c.variedad_id, g);
  }
  const haTxt = (n: number) => n.toLocaleString("es-CL", { maximumFractionDigits: 1 });
  const nombreVariedad = new Map<string, string>([...porVar].map(([id, g]) => [id, `${g.variedad} completa (${haTxt(g.ha)} ha)`]));
  const variedades: OpX[] = [...porVar]
    .filter(([, g]) => g.codigos.length >= 2)
    .sort((a, b) => (a[1].especie + a[1].variedad).localeCompare(b[1].especie + b[1].variedad, "es"))
    .map(([id, g]) => ({ id: `v:${id}`, texto: `${g.variedad} · ${haTxt(g.ha)} ha`, especie: g.especieId, ha: Math.round(g.ha * 100) / 100 }));
  const labores: OpX[] = ((la ?? []) as any[])
    .filter((l) => l.activo || l.id === incluir?.labor)
    .map((l) => ({ id: l.id, texto: l.nombre, categoria: l.categoria ?? "Otras", especies: l.especies ?? null }))
    .sort((a, b) => CATEGORIAS.indexOf(a.categoria!) - CATEGORIAS.indexOf(b.categoria!) || a.texto.localeCompare(b.texto, "es"));
  const nomCuadrilla = (c: any) => (c.jefe ? `${c.nombre} (${c.jefe})` : c.nombre);
  const cuadrillas: OpX[] = ((cd ?? []) as any[]).filter((c) => c.activo || c.id === incluir?.cuadrilla).map((c) => ({ id: c.id, texto: nomCuadrilla(c), tipo: c.tipo, rut: c.rut ?? null }));
  const trabajadores: Op[] = ((tr ?? []) as any[]).filter((t) => t.activo || t.id === incluir?.fiscalizador).map((t) => ({ id: t.id, texto: t.nombre }));
  const nombreCuartel = new Map<string, string>(cuarteles.map((c) => [c.id, c.texto]));
  const especieDeVariedad = new Map<string, string | null>([...porVar].map(([id, g]) => [id, g.especieId]));
  const especieDeCuartel = new Map<string, string | null>(cuarteles.map((c) => [c.id, c.especie ?? null]));
  const variedadDeCuartel = new Map<string, string | null>(((cu ?? []) as any[]).map((c) => [c.id as string, (c.variedad_id as string | null) ?? null]));
  /** Dónde se hizo: un cuartel, una variedad completa o el campo en general */
  const donde = (x: { cuartel_id?: string | null; variedad_id?: string | null }) =>
    x.cuartel_id ? nombreCuartel.get(x.cuartel_id) ?? "Cuartel" : x.variedad_id ? nombreVariedad.get(x.variedad_id) ?? "Variedad completa" : "General del campo";
  return {
    cuarteles, variedades, donde, labores, cuadrillas, trabajadores,
    especieDeVariedad, especieDeCuartel, variedadDeCuartel,
    especies: [...new Map(((cu ?? []) as any[]).filter((c) => c.especie_id).map((c) => [c.especie_id as string, c.especie as string])).entries()].map(([id, texto]) => ({ id, texto })).sort((a, b) => a.texto.localeCompare(b.texto, "es")),
    variedadesTodas: [...porVar].map(([id, g]) => ({ id, texto: `${g.variedad} (${g.especie})` })).sort((a, b) => a.texto.localeCompare(b.texto, "es")),
    telefonos: {
      trabajador: new Map<string, string | null>(((tr ?? []) as any[]).map((t) => [t.id, t.telefono])),
      cuadrilla: new Map<string, string | null>(((cd ?? []) as any[]).map((c) => [c.id, c.telefono])),
    },
    nombres: {
      trabajador: new Map<string, string>(((tr ?? []) as any[]).map((t) => [t.id, t.nombre])),
      cuartel: nombreCuartel,
      labor: new Map<string, string>(((la ?? []) as any[]).map((l) => [l.id, l.nombre])),
      categoria: new Map<string, string>(((la ?? []) as any[]).map((l) => [l.id, l.categoria ?? "Otras"])),
      cuadrilla: new Map<string, string>(((cd ?? []) as any[]).map((c) => [c.id, nomCuadrilla(c)])),
      rut: new Map<string, string | null>(((cd ?? []) as any[]).map((c) => [c.id, c.rut ?? null])),
    },
  };
}
