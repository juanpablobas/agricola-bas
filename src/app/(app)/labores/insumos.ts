// Insumos de bodega usados en una labor: descuento del stock (salida de bodega ligada a la labor) y costo.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyChile } from "@/lib/semana";

export const IVA = 1.19;

/** Centro de costo para la salida: la variedad de la labor (o la del cuartel); si es general, "General campo". */
export async function cecoDeLabor(supabase: SupabaseClient, l: { cuartel_id: string | null; variedad_id: string | null }) {
  let variedad = l.variedad_id;
  if (!variedad && l.cuartel_id) {
    const { data: c } = await supabase.from("v_cuartel").select("variedad_id").eq("id", l.cuartel_id).maybeSingle();
    variedad = c?.variedad_id ?? null;
  }
  if (variedad) {
    const { data: cv } = await supabase.from("ceco").select("id").eq("variedad_id", variedad).eq("activo", true).limit(1).maybeSingle();
    if (cv) return cv.id as string;
  }
  const { data: generales } = await supabase.from("ceco").select("id, nombre").eq("tipo", "general").eq("activo", true);
  const g = ((generales ?? []) as any[]).find((x) => /general\s*campo/i.test(x.nombre)) ?? (generales ?? [])[0];
  return (g?.id as string) ?? null;
}

/** Descuenta de bodega los insumos de la labor que todavía no se descuentan. Devuelve los que no alcanzaron. */
export async function descontarPendientes(supabase: SupabaseClient, laborId: string, userId: string) {
  const { data: l } = await supabase.from("labor_registro").select("id, estado, fecha, fecha_inicio, cuartel_id, variedad_id, labor_tipo_id, labor_tipo(nombre)").eq("id", laborId).maybeSingle();
  if (!l || (l.estado !== "en_ejecucion" && l.estado !== "realizado")) return [] as string[];
  const { data: pend } = await supabase.from("labor_insumo").select("id, producto_id, cantidad").eq("labor_id", laborId).eq("descontar", true).is("mov_id", null);
  if (!pend?.length) return [] as string[];
  const hoy = hoyChile();
  const fecha = [l.fecha_inicio, l.fecha].find((f) => f && f <= hoy) ?? hoy;
  const ceco = await cecoDeLabor(supabase, l as any);
  const ids = [...new Set((pend as any[]).map((p) => p.producto_id))];
  const { data: stocks } = await supabase.from("v_stock").select("producto_id, nombre, stock").in("producto_id", ids);
  const stock = new Map(((stocks ?? []) as any[]).map((s) => [s.producto_id as string, { nombre: s.nombre as string, stock: Number(s.stock) }]));
  const faltan: string[] = [];
  for (const p of pend as any[]) {
    const s = stock.get(p.producto_id);
    const cant = Number(p.cantidad);
    if (!s || cant > s.stock + 0.0005) {
      faltan.push(s?.nombre ?? "producto");
      continue;
    }
    const { data: mov, error } = await supabase
      .from("mov_inventario")
      .insert({ tipo: "salida", origen: "manual", fecha, producto_id: p.producto_id, cantidad: cant, ceco_id: ceco, observacion: `Labor: ${(l as any).labor_tipo?.nombre ?? "labor"}`, creado_por: userId, labor_id: laborId })
      .select("id")
      .single();
    if (error || !mov) {
      console.error("descontarPendientes", error);
      faltan.push(s.nombre);
      continue;
    }
    s.stock -= cant;
    await supabase.from("labor_insumo").update({ mov_id: mov.id }).eq("id", p.id);
  }
  return faltan;
}

/** El costo de insumos de la labor = suma de los insumos de bodega (si tiene) */
export async function recalcularCostoInsumos(supabase: SupabaseClient, laborId: string) {
  const { data: ins } = await supabase.from("labor_insumo").select("cantidad, costo_unitario").eq("labor_id", laborId);
  if (!ins) return;
  if (ins.length === 0) return;
  const total = (ins as any[]).reduce((s, x) => s + Number(x.cantidad) * Number(x.costo_unitario ?? 0), 0);
  await supabase.from("labor_registro").update({ costo_insumos: Math.round(total) || null }).eq("id", laborId);
}
