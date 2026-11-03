"use server";
import { hoyChile } from "@/lib/semana";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { leerNumero, leerTexto } from "@/lib/formato";
import type { EstadoFormulario } from "@/components/Aviso";

export async function registrarSalida(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase, user } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");

  const productoId = String(form.get("producto") ?? "");
  const cantidad = leerNumero(form.get("cantidad"));
  const fecha = String(form.get("fecha") ?? "");
  const cecoId = String(form.get("ceco") ?? "");
  const observacion = leerTexto(form.get("observacion"));

  if (!productoId) return { error: "Elige el producto." };
  if (cantidad === null || cantidad <= 0) return { error: "La cantidad debe ser mayor que cero." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Indica la fecha." };
  if (fecha > hoyChile()) return { error: "La fecha no puede ser futura." };
  if (!cecoId) return { error: "Elige a qué variedad o centro de costo se destinó." };

  const { data: p } = await supabase.from("v_stock").select("nombre, stock, unidad").eq("producto_id", productoId).maybeSingle();
  if (!p) return { error: "No encontré ese producto." };
  if (cantidad > Number(p.stock) + 0.0005) {
    return { error: `Solo hay ${Number(p.stock).toLocaleString("es-CL", { maximumFractionDigits: 2 })} ${p.unidad ?? ""} de ${p.nombre}. Revisa la cantidad.` };
  }

  const { error } = await supabase.from("mov_inventario").insert({
    tipo: "salida",
    origen: "manual",
    fecha,
    producto_id: productoId,
    cantidad,
    ceco_id: cecoId,
    observacion,
    creado_por: user.id,
  });
  if (error) return { error: "No se pudo guardar la salida." };

  revalidatePath("/inventario", "layout");
  redirect(`/inventario/${productoId}`);
}
