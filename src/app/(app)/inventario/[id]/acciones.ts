"use server";
import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/auth";
import type { EstadoFormulario } from "@/components/Aviso";

export async function guardarUnidad(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const id = String(form.get("id") ?? "");
  const unidad = String(form.get("unidad") ?? "");
  if (!["Kg", "L", "un", "m", "rollo"].includes(unidad)) return { error: "Elige una unidad." };
  const { error } = await supabase.from("producto").update({ unidad }).eq("id", id);
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/inventario", "layout");
  return { ok: "Unidad guardada." };
}

export async function borrarMovimiento(form: FormData) {
  const { supabase } = await exigirRol("administrador", "enc_administrativo");
  const id = String(form.get("id") ?? "");
  const producto = String(form.get("producto") ?? "");
  // Solo se pueden borrar las salidas hechas a mano; las del archivo vienen del administrador.
  await supabase.from("mov_inventario").delete().eq("id", id).eq("origen", "manual");
  revalidatePath(`/inventario/${producto}`);
  revalidatePath("/inventario");
}
