"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { leerNumero } from "@/lib/formato";
import { clave, leerTodo, opcionesDeTexto } from "@/lib/programas";

type L = { id: string; aplicacion_id: string; orden: number; producto: string; alternativas: string | null; grupo_alt: number | null; relacion: string | null; caracter: string | null };

/** Guarda (o borra, si se deja vacío) el precio de referencia de un producto. */
export async function guardarPrecio(form: FormData) {
  const { supabase, user } = await exigirRol("administrador", "enc_administrativo");
  const nombre = String(form.get("opcion") ?? "").trim();
  if (!nombre) redirect("/programas/opciones?error=1");
  const precio = leerNumero(form.get("precio"));
  const k = clave(nombre);
  if (precio === null) {
    await supabase.from("precio_referencia").delete().eq("nombre_clave", k);
  } else {
    if (!(precio > 0)) redirect("/programas/opciones?error=precio");
    const { error } = await supabase.from("precio_referencia").upsert({ nombre_clave: k, nombre, precio, actualizado: new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }), actualizado_por: user.id }, { onConflict: "nombre_clave" });
    if (error) redirect("/programas/opciones?error=1");
  }
  revalidatePath("/programas/opciones");
  redirect("/programas/opciones?ok=precio");
}

/**
 * Cambia el producto principal por una de las opciones del asesor, en todas las aplicaciones donde aparece.
 * El producto que estaba pasa a ser una opción, así que se puede volver atrás.
 */
export async function usarOpcion(form: FormData) {
  const { supabase } = await exigirRol("administrador", "enc_administrativo");
  const producto = String(form.get("producto") ?? "");
  const opcion = String(form.get("opcion") ?? "");
  if (!producto || !opcion) redirect("/programas/opciones?error=1");

  const { data: prods } = await supabase.from("producto").select("id, nombre").range(0, 1999);
  const idPorClave = new Map<string, string>((prods ?? []).map((p: any) => [clave(p.nombre as string), p.id as string] as [string, string]));

  const principales = ((await leerTodo<L>((d, h) => supabase.from("programa_linea").select("id, aplicacion_id, orden, producto, alternativas, grupo_alt, relacion, caracter").eq("producto", producto).range(d, h))) ?? []).filter((l) => (l.grupo_alt ?? 0) === 0);
  if (principales.length === 0) redirect("/programas/opciones?error=1");
  const appIds = [...new Set(principales.map((l) => l.aplicacion_id))];
  const deLasApps = await leerTodo<L>((d, h) => supabase.from("programa_linea").select("id, aplicacion_id, orden, producto, alternativas, grupo_alt, relacion, caracter").in("aplicacion_id", appIds).order("orden").range(d, h));

  let cambiadas = 0;
  for (const l of principales) {
    const mias = deLasApps.filter((x) => x.aplicacion_id === l.aplicacion_id).sort((a, b) => a.orden - b.orden);
    const siguientePrincipal = mias.find((x) => x.orden > l.orden && (x.grupo_alt ?? 0) === 0)?.orden ?? Infinity;
    const alt = mias.find((x) => x.orden > l.orden && x.orden < siguientePrincipal && (x.grupo_alt ?? 0) !== 0 && clave(x.producto) === clave(opcion));

    if (alt) {
      // Opción con dosis propia (viene como línea aparte): se intercambian los papeles
      const a1 = await supabase.from("programa_linea").update({ grupo_alt: 0, caracter: "Fija", relacion: l.relacion }).eq("id", alt.id);
      const a2 = await supabase.from("programa_linea").update({ grupo_alt: alt.grupo_alt, caracter: "Alternativa", relacion: "O" }).eq("id", l.id);
      if (!a1.error && !a2.error) cambiadas++;
      continue;
    }
    const lista = opcionesDeTexto(l.alternativas);
    const elegida = lista.find((x) => clave(x) === clave(opcion));
    if (elegida) {
      // Opción escrita como texto: se cambia el nombre y se conserva la dosis del principal
      const resto = [...lista.filter((x) => x !== elegida), l.producto];
      const { error } = await supabase.from("programa_linea").update({ producto: elegida, alternativas: resto.join(" o "), producto_id: idPorClave.get(clave(elegida)) ?? null, ingrediente_activo: null }).eq("id", l.id);
      if (!error) cambiadas++;
    }
  }
  const volver = String(form.get("volver") ?? "");
  const aPedido = volver.startsWith("/programas/pedido");
  if (cambiadas === 0) redirect(aPedido ? `${volver}&error=opcion` : "/programas/opciones?error=1");
  revalidatePath("/programas", "layout");
  redirect(aPedido ? `${volver}&ok=usada&opcion=${encodeURIComponent(opcion)}` : `/programas/opciones?ok=usada&n=${cambiadas}`);
}
