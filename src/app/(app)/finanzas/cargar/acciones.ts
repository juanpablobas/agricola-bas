"use server";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/auth";
import type { EstadoFormulario } from "@/components/Aviso";
import {
  esHojaGastos,
  esHojaPresupuesto,
  leerGastos,
  leerPresupuesto,
  nombreTemporada,
  type Hoja,
} from "@/lib/finanzas/leer";
import { clp, fecha as fechaCL, num } from "@/lib/formato";

const LOTE = 500;

function enLotes<T>(a: T[]) {
  const r: T[][] = [];
  for (let i = 0; i < a.length; i += LOTE) r.push(a.slice(i, i + LOTE));
  return r;
}

export async function cargarArchivo(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase, user } = await exigirRol("administrador", "enc_administrativo");

  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo Excel del administrador." };
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

  const quierePpto = form.get("presupuesto") === "on";
  const quiereGastos = form.get("gastos") === "on";
  const hojaPpto = quierePpto ? hojas.find(esHojaPresupuesto) : undefined;
  const hojaGastos = quiereGastos ? hojas.find(esHojaGastos) : undefined;
  if (!quierePpto && !quiereGastos) return { error: "Marca qué quieres cargar: presupuesto, gastos o ambos." };
  if (quierePpto && !hojaPpto) return { error: "No encontré la hoja del presupuesto en el archivo (con columnas Items, CUARTEL, Fecha, SUB-LABOR y CT TOTAL)." };
  if (quiereGastos && !hojaGastos) return { error: "No encontré la hoja de gastos en el archivo (con columnas Items, Cuartel, Fecha, Proveedor, Rut y Total)." };

  let ppto: ReturnType<typeof leerPresupuesto> | null;
  let gastos: ReturnType<typeof leerGastos> | null;
  try {
    ppto = hojaPpto ? leerPresupuesto(hojaPpto) : null;
    gastos = hojaGastos ? leerGastos(hojaGastos) : null;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }
  if (ppto && ppto.lineas.length === 0) return { error: "La hoja del presupuesto no tiene filas con datos." };
  if (gastos && gastos.lineas.length === 0) return { error: "La hoja de gastos no tiene filas con datos." };

  // Temporada: la que contiene la primera fecha del archivo
  const fechas = [...(ppto?.lineas.map((l) => l.mes) ?? []), ...(gastos?.lineas.map((l) => l.fecha) ?? [])].sort();
  const nombre = nombreTemporada(fechas[0]);
  const { data: temporada } = await supabase.from("temporada").select("id, nombre, inicio, termino").eq("nombre", nombre).maybeSingle();
  if (!temporada) return { error: `El archivo corresponde a la temporada ${nombre}, que no existe. Créala primero en Campo.` };

  const { data: cecos } = await supabase.from("ceco").select("id, codigo");
  const cecoId = new Map((cecos ?? []).map((c) => [c.codigo, c.id as string]));

  if (ppto) {
    const faltan = [...new Set(ppto.lineas.map((l) => l.cecoCodigo).filter((c) => !cecoId.has(c)))];
    if (faltan.length) return { error: `El presupuesto usa centros de costo que no existen en la app: ${faltan.join(", ")}.` };
  }

  const resumen: string[] = [];
  const avisos: string[] = [...(ppto?.avisos ?? []), ...(gastos?.avisos ?? [])];

  async function nuevaCarga(tipo: "presupuesto" | "gastos", filas: number, total: number, desde: string, hasta: string) {
    const { data, error } = await supabase
      .from("carga_finanzas")
      .insert({ tipo, temporada_id: temporada!.id, archivo: archivo instanceof File ? archivo.name : "", filas, total, desde, hasta, subido_por: user.id })
      .select("id")
      .single();
    if (error || !data) throw new Error("No se pudo registrar la carga.");
    return data.id as string;
  }

  /** Deja como "reemplazadas" las cargas anteriores del mismo tipo y borra sus líneas. */
  async function reemplazarAnteriores(tipo: "presupuesto" | "gastos", nuevaId: string) {
    const { data: viejas } = await supabase
      .from("carga_finanzas")
      .select("id")
      .eq("tipo", tipo)
      .eq("temporada_id", temporada!.id)
      .eq("estado", "vigente")
      .neq("id", nuevaId);
    const ids = (viejas ?? []).map((v) => v.id as string);
    if (!ids.length) return;
    await supabase.from(tipo === "gastos" ? "gasto" : "presupuesto_linea").delete().in("carga_id", ids);
    await supabase.from("carga_finanzas").update({ estado: "reemplazada" }).in("id", ids);
  }

  try {
    if (ppto) {
      const L = ppto.lineas;
      const total = L.reduce((s, l) => s + l.monto, 0);
      const meses = L.map((l) => l.mes).sort();
      const id = await nuevaCarga("presupuesto", L.length, total, meses[0], meses[meses.length - 1]);
      for (const lote of enLotes(L)) {
        const { error } = await supabase.from("presupuesto_linea").insert(
          lote.map((l) => ({
            carga_id: id,
            temporada_id: temporada.id,
            ceco_id: cecoId.get(l.cecoCodigo)!,
            item: l.item,
            labor: l.labor,
            sublabor: l.sublabor,
            udc: l.udc,
            mes: l.mes,
            monto: l.monto,
            cerrado: l.cerrado,
          })),
        );
        if (error) {
          await supabase.from("carga_finanzas").delete().eq("id", id);
          return { error: "Falló la carga del presupuesto; no se cambió nada. " + error.message };
        }
      }
      await reemplazarAnteriores("presupuesto", id);
      resumen.push(`Presupuesto: ${num(L.length)} líneas por ${clp(total)}.`);
    }

    if (gastos) {
      const L = gastos.lineas;
      const total = L.reduce((s, l) => s + l.total, 0);
      const fs = L.map((l) => l.fecha).sort();
      const id = await nuevaCarga("gastos", L.length, total, fs[0], fs[fs.length - 1]);

      // Proveedores nuevos
      const provs = new Map<string, string>();
      for (const l of L) if (l.proveedorRut && !provs.has(l.proveedorRut)) provs.set(l.proveedorRut, l.proveedorNombre ?? l.proveedorRut);
      for (const lote of enLotes([...provs])) {
        const { error } = await supabase
          .from("proveedor")
          .upsert(lote.map(([rut, nombre]) => ({ rut, nombre })), { onConflict: "rut", ignoreDuplicates: true });
        if (error) {
          await supabase.from("carga_finanzas").delete().eq("id", id);
          return { error: "Falló la carga de proveedores; no se cambió nada. " + error.message };
        }
      }
      const { data: proveedores } = await supabase.from("proveedor").select("id, rut");
      const provId = new Map((proveedores ?? []).map((p) => [p.rut, p.id as string]));

      const sinCeco = new Map<string, number>();
      for (const lote of enLotes(L)) {
        const { error } = await supabase.from("gasto").insert(
          lote.map((l) => {
            const ceco = cecoId.get(l.cecoCodigo) ?? null;
            if (!ceco) sinCeco.set(l.cecoCodigo || "(vacío)", (sinCeco.get(l.cecoCodigo || "(vacío)") ?? 0) + 1);
            return {
              carga_id: id,
              temporada_id: temporada.id,
              ceco_id: ceco,
              ceco_original: l.cecoCodigo || null,
              proveedor_id: l.proveedorRut ? provId.get(l.proveedorRut) ?? null : null,
              item: l.item,
              sublabor_ppto: l.sublaborPpto,
              tipo_documento: l.tipoDocumento,
              numero_documento: l.numeroDocumento,
              fecha: l.fecha,
              semana: l.semana,
              detalle: l.detalle,
              exento: l.exento,
              neto: l.neto,
              iva: l.iva,
              total: l.total,
              sin_presupuesto: l.sinPresupuesto,
            };
          }),
        );
        if (error) {
          await supabase.from("carga_finanzas").delete().eq("id", id);
          return { error: "Falló la carga de gastos; no se cambió nada. " + error.message };
        }
      }
      await reemplazarAnteriores("gastos", id);
      resumen.push(`Gastos: ${num(L.length)} documentos por ${clp(total)}, del ${fechaCL(fs[0])} al ${fechaCL(fs[fs.length - 1])}.`);
      if (sinCeco.size)
        avisos.push(`Quedaron sin centro de costo asignado: ${[...sinCeco].map(([c, n]) => `${c} (${n})`).join(", ")}.`);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo completar la carga." };
  }

  revalidatePath("/finanzas", "layout");
  return { ok: `Temporada ${temporada.nombre}. ${resumen.join(" ")}${avisos.length ? " Ojo: " + avisos.join(" ") : ""}` };
}
