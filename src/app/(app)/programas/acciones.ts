"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { leerNumero, leerTexto } from "@/lib/formato";
import type { EstadoFormulario } from "@/components/Aviso";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guarda el mojamiento real (litros por ha) por variedad y mes. Vacío = usar el del programa. */
export async function guardarMojamiento(form: FormData) {
  const { supabase, user } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const guardar: { variedad_id: string; mes: number; litros_ha: number; actualizado_por: string; actualizado_en: string }[] = [];
  const borrar: { variedad_id: string; mes: number }[] = [];

  for (const [k, v] of form.entries()) {
    const m = /^m_([0-9a-f-]{36})_(\d{1,2})$/i.exec(k);
    if (!m || !UUID.test(m[1])) continue;
    const mes = Number(m[2]);
    if (mes < 1 || mes > 12) continue;
    const litros = leerNumero(v as string);
    if (litros === null) borrar.push({ variedad_id: m[1], mes });
    else if (litros >= 100 && litros <= 10000) guardar.push({ variedad_id: m[1], mes, litros_ha: Math.round(litros), actualizado_por: user.id, actualizado_en: new Date().toISOString() });
    else redirect("/programas/mojamiento?error=rango");
  }

  if (guardar.length) {
    const { error } = await supabase.from("mojamiento_real").upsert(guardar, { onConflict: "variedad_id,mes" });
    if (error) redirect("/programas/mojamiento?error=guardar");
  }
  for (const b of borrar) await supabase.from("mojamiento_real").delete().eq("variedad_id", b.variedad_id).eq("mes", b.mes);

  revalidatePath("/programas", "layout");
  redirect("/programas/mojamiento?ok=1");
}

/** Une un producto de los programas con un producto de la bodega (o lo desune si no se elige ninguno). */
export async function vincularProducto(form: FormData) {
  const { supabase } = await exigirRol("administrador", "enc_administrativo");
  const nombre = String(form.get("nombre") ?? "");
  const producto = String(form.get("producto") ?? "");
  if (!nombre || (producto && !UUID.test(producto))) redirect("/programas/vincular?error=1");
  const { error } = await supabase.from("programa_linea").update({ producto_id: producto || null }).eq("producto", nombre);
  if (error) redirect("/programas/vincular?error=1");
  revalidatePath("/programas", "layout");
  redirect("/programas/vincular?ok=1");
}

/** Registra una aplicación hecha y descuenta del inventario lo usado. */
export async function registrarAplicacion(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");

  const variedad = String(form.get("variedad") ?? "");
  const progApp = String(form.get("prog_app") ?? "");
  const fecha = String(form.get("fecha") ?? "");
  const litros = leerNumero(form.get("litros"));
  const ha = leerNumero(form.get("ha"));
  const obs = leerTexto(form.get("obs"));
  const titulo = leerTexto(form.get("titulo"));
  const ids = form.getAll("linea").map(String).filter((x) => UUID.test(x));

  if (!UUID.test(variedad) || !UUID.test(progApp)) return { error: "Falta elegir la variedad y la aplicación." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Indica la fecha." };
  if (fecha > new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" })) return { error: "La fecha no puede ser futura." };
  if (litros === null || litros < 100 || litros > 10000) return { error: "Los litros por hectárea deben estar entre 100 y 10.000." };
  if (ha === null || ha <= 0 || ha > 500) return { error: "Indica las hectáreas aplicadas." };

  const marcadas = ids.filter((id) => form.get(`usar_${id}`) === "on");
  if (marcadas.length === 0) return { error: "Marca al menos un producto." };

  const { data: lineas } = await supabase.from("programa_linea").select("id, producto, producto_id").in("id", marcadas);
  const porId = new Map((lineas ?? []).map((l: any) => [l.id as string, l]));

  const lista: { producto_id: string; cantidad: number }[] = [];
  let sinVincular = 0;
  for (const id of marcadas) {
    const l: any = porId.get(id);
    if (!l) continue;
    const cant = leerNumero(form.get(`cant_${id}`));
    if (cant === null || cant <= 0) return { error: `Revisa la cantidad de ${l.producto}.` };
    if (!l.producto_id) { sinVincular++; continue; }
    lista.push({ producto_id: l.producto_id, cantidad: Math.round(cant * 10000) / 10000 });
  }
  if (lista.length === 0) return { error: "Ninguno de los productos marcados está vinculado a la bodega, así que no hay nada que descontar. Vincúlalos primero en “Productos sin vincular”." };

  const { error } = await supabase.rpc("registrar_aplicacion", {
    p_fecha: fecha, p_variedad: variedad, p_prog_app: progApp, p_titulo: titulo, p_litros: litros, p_ha: ha, p_obs: obs, p_lineas: lista,
  });
  if (error) {
    const msg = error.message ?? "";
    if (msg.startsWith("No alcanza") || msg.startsWith("Esa variedad")) return { error: msg };
    return { error: "No se pudo guardar la aplicación. No se descontó nada del inventario." };
  }

  revalidatePath("/programas", "layout");
  revalidatePath("/inventario", "layout");
  redirect(`/programas/historial?ok=1${sinVincular ? `&sin=${sinVincular}` : ""}`);
}

/** Borra una aplicación registrada y devuelve al inventario lo que se había descontado. */
export async function borrarAplicacion(form: FormData) {
  const { supabase } = await exigirRol("administrador", "enc_administrativo");
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) redirect("/programas/historial");
  await supabase.from("aplicacion_realizada").delete().eq("id", id);
  revalidatePath("/programas", "layout");
  revalidatePath("/inventario", "layout");
  redirect("/programas/historial?borrada=1");
}
