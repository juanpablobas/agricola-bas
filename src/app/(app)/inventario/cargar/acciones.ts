"use server";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/auth";
import type { EstadoFormulario } from "@/components/Aviso";
import type { Hoja } from "@/lib/finanzas/leer";
import { claveProducto, esHojaIngresos, esHojaSalidas, leerIngresos, leerSalidas, type Clasificacion } from "@/lib/inventario/leer";
import { num } from "@/lib/formato";

const LOTE = 500;
const enLotes = <T,>(a: T[]) => Array.from({ length: Math.ceil(a.length / LOTE) }, (_, i) => a.slice(i * LOTE, (i + 1) * LOTE));

export async function cargarInventario(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase, user } = await exigirRol("administrador", "enc_administrativo");

  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo Excel de inventario." };
  if (!/\.xlsx?$/i.test(archivo.name)) return { error: "El archivo debe ser Excel (.xlsx)." };
  if (archivo.size > 9 * 1024 * 1024) return { error: "El archivo pesa más de 9 MB." };

  let hojas: Hoja[];
  try {
    const libro = XLSX.read(Buffer.from(await archivo.arrayBuffer()), { type: "buffer", cellDates: true });
    hojas = libro.SheetNames.map((nombre) => ({
      nombre,
      filas: XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, raw: true, defval: null }) as unknown[][],
    }));
  } catch {
    return { error: "No se pudo leer el archivo. Revisa que sea un Excel válido." };
  }

  const hi = hojas.find(esHojaIngresos);
  const hs = hojas.find(esHojaSalidas);
  if (!hi) return { error: "No encontré la hoja de Ingresos (con Fecha, Clasificación, Proveedor, Factura, Descripción, Cantidad y Valor)." };
  if (!hs) return { error: "No encontré la hoja de Salidas (con Fecha, Clasificación, Descripción, Cantidad y Cuartel Salida)." };

  let ing: ReturnType<typeof leerIngresos>;
  let sal: ReturnType<typeof leerSalidas>;
  try {
    ing = leerIngresos(hi);
    sal = leerSalidas(hs);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }
  if (ing.lineas.length === 0) return { error: "La hoja de Ingresos no tiene filas con datos." };

  // Productos (la clasificación es la del primer ingreso; si no hay, la de la primera salida)
  const productos = new Map<string, { nombre: string; clasificacion: Clasificacion }>();
  for (const x of [...ing.lineas, ...sal.lineas]) {
    const k = claveProducto(x.producto);
    if (!productos.has(k)) productos.set(k, { nombre: x.producto, clasificacion: x.clasificacion });
  }

  const fechas = [...ing.lineas.map((l) => l.fecha), ...sal.lineas.map((l) => l.fecha)].sort();
  const desde = fechas[0];
  const hasta = fechas[fechas.length - 1];

  const { data: carga, error: eCarga } = await supabase
    .from("carga_inventario")
    .insert({ archivo: archivo.name, ingresos: ing.lineas.length, salidas: sal.lineas.length, desde, hasta, subido_por: user.id })
    .select("id")
    .single();
  if (eCarga || !carga) return { error: "No se pudo registrar la carga." };

  const fallar = async (msg: string, detalle?: string): Promise<EstadoFormulario> => {
    await supabase.from("carga_inventario").delete().eq("id", carga.id);
    return { error: `${msg} No se cambió nada.${detalle ? " " + detalle : ""}` };
  };

  for (const lote of enLotes([...productos].map(([nombre_clave, p]) => ({ nombre_clave, nombre: p.nombre, clasificacion: p.clasificacion })))) {
    const { error } = await supabase.from("producto").upsert(lote, { onConflict: "nombre_clave", ignoreDuplicates: true });
    if (error) return fallar("Falló la carga de productos.", error.message);
  }
  const { data: prods } = await supabase.from("producto").select("id, nombre_clave");
  const idProducto = new Map((prods ?? []).map((p) => [p.nombre_clave as string, p.id as string]));

  const { data: cecos } = await supabase.from("ceco").select("id, codigo");
  const idCeco = new Map((cecos ?? []).map((c) => [c.codigo as string, c.id as string]));

  const movs = [
    ...ing.lineas.map((l) => ({
      carga_id: carga.id,
      tipo: "ingreso",
      fecha: l.fecha,
      producto_id: idProducto.get(claveProducto(l.producto))!,
      cantidad: l.cantidad,
      valor_unitario: l.valorTotal > 0 ? l.valorTotal / l.cantidad : null,
      valor_total: l.valorTotal,
      proveedor: l.proveedor,
      factura: l.factura,
      origen: "archivo",
    })),
    ...sal.lineas.map((l) => ({
      carga_id: carga.id,
      tipo: "salida",
      fecha: l.fecha,
      producto_id: idProducto.get(claveProducto(l.producto))!,
      cantidad: l.cantidad,
      valor_unitario: l.valorUnitario || null,
      valor_total: l.valorTotal || null,
      factura: l.factura,
      ceco_id: idCeco.get(l.destino) ?? null,
      destino_original: l.destino,
      origen: "archivo",
    })),
  ];
  for (const lote of enLotes(movs)) {
    const { error } = await supabase.from("mov_inventario").insert(lote);
    if (error) return fallar("Falló la carga de movimientos.", error.message);
  }

  // El archivo del administrador es acumulado: reemplaza los movimientos de archivos anteriores
  const { data: viejas } = await supabase.from("carga_inventario").select("id").eq("estado", "vigente").neq("id", carga.id);
  const ids = (viejas ?? []).map((v) => v.id as string);
  if (ids.length) {
    await supabase.from("mov_inventario").delete().in("carga_id", ids);
    await supabase.from("carga_inventario").update({ estado: "reemplazada" }).in("id", ids);
  }

  const { count: manuales } = await supabase
    .from("mov_inventario")
    .select("id", { count: "exact", head: true })
    .eq("origen", "manual")
    .lte("fecha", hasta);

  const avisos = [...ing.avisos, ...sal.avisos];
  if (manuales) avisos.push(`Hay ${num(manuales)} salidas registradas a mano en la app con fecha hasta ${hasta.split("-").reverse().join("-")}. Si ya vienen en este archivo, bórralas en el detalle del producto para no contarlas dos veces.`);

  revalidatePath("/inventario", "layout");
  return {
    ok: `Inventario cargado: ${num(ing.lineas.length)} ingresos y ${num(sal.lineas.length)} salidas de ${num(productos.size)} productos.${avisos.length ? " Ojo: " + avisos.join(" ") : ""}`,
  };
}
