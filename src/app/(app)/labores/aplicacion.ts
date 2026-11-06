// Cálculo de una aplicación del programa por variedad: hectáreas, mojamiento y cantidad de cada producto.
import type { SupabaseClient } from "@supabase/supabase-js";
import { clave, dosisPorHa, esPrincipal, normalizarLinea, type Linea } from "@/lib/programas";

export type ProductoCalc = { linea_id: string; nombre: string; unidad: string; producto_id: string | null; enBodega: string | null; stock: number | null; porVariedad: Map<string, number>; total: number };
export type VariedadCalc = { id: string; nombre: string; ha: number; litros: number | null; litrosReal: boolean };

export async function calcularAplicacion(supabase: SupabaseClient, appId: string) {
  const { data: app } = await supabase.from("programa_aplicacion").select("id, programa_id, orden, titulo, mes, estado_fenologico, fecha_estimada, programa(nombre)").eq("id", appId).maybeSingle();
  if (!app) return null;
  const [{ data: lineasRaw }, { data: pv }, { data: hechas }, { data: cuarteles }, { data: reales }, { data: catalogo }] = await Promise.all([
    supabase.from("programa_linea").select("*").eq("aplicacion_id", appId).order("orden"),
    supabase.from("programa_variedad").select("variedad_id, variedad(nombre)").eq("programa_id", app.programa_id),
    supabase.from("aplicacion_realizada").select("variedad_id").eq("programa_aplicacion_id", appId),
    supabase.from("v_cuartel").select("variedad_id, superficie_ha, estado_productivo").eq("activo", true).range(0, 999),
    app.mes ? supabase.from("mojamiento_real").select("variedad_id, litros_ha").eq("mes", app.mes) : Promise.resolve({ data: [] as any[] }),
    supabase.from("producto").select("id, nombre, unidad").range(0, 1999),
  ]);
  const lineas = ((lineasRaw ?? []) as any[]).map(normalizarLinea).filter(esPrincipal) as Linea[];
  const hecha = new Set(((hechas ?? []) as any[]).map((h) => h.variedad_id as string));
  const haPor = new Map<string, number>();
  for (const c of (cuarteles ?? []) as any[]) {
    if (!c.variedad_id || c.estado_productivo === "sin_plantar" || c.estado_productivo === "eliminado") continue;
    haPor.set(c.variedad_id, (haPor.get(c.variedad_id) ?? 0) + Number(c.superficie_ha ?? 0));
  }
  const real = new Map(((reales ?? []) as any[]).map((r) => [r.variedad_id as string, Number(r.litros_ha)]));
  const mojPrograma = lineas.find((l) => l.mojam_programa && l.mojam_programa >= 100)?.mojam_programa ?? null;
  const variedades: VariedadCalc[] = ((pv ?? []) as any[])
    .filter((x) => !hecha.has(x.variedad_id))
    .map((x) => ({ id: x.variedad_id, nombre: x.variedad?.nombre ?? "", ha: Math.round((haPor.get(x.variedad_id) ?? 0) * 100) / 100, litros: real.get(x.variedad_id) ?? mojPrograma, litrosReal: real.has(x.variedad_id) }))
    .filter((v) => v.ha > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const porClave = new Map<string, { id: string; nombre: string; unidad: string | null; n: number }>();
  for (const p of (catalogo ?? []) as any[]) {
    const k = clave(p.nombre);
    porClave.set(k, { id: p.id, nombre: p.nombre, unidad: p.unidad, n: (porClave.get(k)?.n ?? 0) + 1 });
  }
  const nombreBodega = new Map(((catalogo ?? []) as any[]).map((p) => [p.id as string, p.nombre as string]));
  const productos: ProductoCalc[] = lineas.map((l) => {
    const m = porClave.get(clave(l.producto));
    const pid = l.producto_id ?? (m && m.n === 1 ? m.id : null);
    const porVariedad = new Map<string, number>();
    for (const v of variedades) {
      const q = Math.round(dosisPorHa(l, v.litros) * v.ha * 1000) / 1000;
      if (q > 0) porVariedad.set(v.id, q);
    }
    return { linea_id: l.id, nombre: l.producto, unidad: l.unidad ?? m?.unidad ?? "", producto_id: pid, enBodega: pid ? nombreBodega.get(pid) ?? null : null, stock: null, porVariedad, total: [...porVariedad.values()].reduce((s, x) => s + x, 0) };
  });
  const ids = [...new Set(productos.map((p) => p.producto_id).filter(Boolean))] as string[];
  const { data: stocks } = ids.length ? await supabase.from("v_stock").select("producto_id, stock").in("producto_id", ids) : { data: [] as any[] };
  const stockDe = new Map(((stocks ?? []) as any[]).map((s) => [s.producto_id as string, Number(s.stock)]));
  for (const p of productos) p.stock = p.producto_id ? stockDe.get(p.producto_id) ?? 0 : null;

  const programa = (app as any).programa?.nombre?.split("(")[0].trim() ?? "Programa";
  const titulo = app.titulo || `Aplicación ${app.orden}${app.estado_fenologico ? ` · ${String(app.estado_fenologico).toLowerCase()}` : ""}`;
  return { app, programa, titulo, variedades, productos };
}
