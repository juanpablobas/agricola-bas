"use server";
import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/auth";
import type { EstadoFormulario } from "@/components/Aviso";
import type { Hoja } from "@/lib/finanzas/leer";
import { esHojaPetroleo, leerPetroleo, tipoMaquina } from "@/lib/petroleo/leer";
import { num } from "@/lib/formato";

const LOTE = 500;

export async function cargarPetroleo(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase, user } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");

  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo Excel del control de petróleo." };
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

  // La hoja Consolidado junta todos los meses; si no está, se usa la primera que tenga las columnas
  const hoja = hojas.find((h) => /consolidado/i.test(h.nombre) && esHojaPetroleo(h)) ?? hojas.find(esHojaPetroleo);
  if (!hoja) return { error: "No encontré la hoja Consolidado (con Fecha, Maquinaria / Vehículo, Labor, Entrada, Salida Petroleo y Saldo)." };

  let lectura: ReturnType<typeof leerPetroleo>;
  try {
    lectura = leerPetroleo(hoja);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }
  const movs = lectura.movimientos;
  if (movs.filter((m) => m.tipo !== "saldo").length === 0) return { error: "La hoja no tiene cargas ni salidas de petróleo." };

  // Máquinas: se crean las que no existan (la marca "Arriendo" la marca como arrendada)
  const nombres = new Map<string, string | null>();
  for (const m of movs) if (m.maquina && !nombres.has(m.maquina)) nombres.set(m.maquina, m.marca);
  const { data: existentes } = await supabase.from("maquina").select("id, nombre");
  const idDe = new Map<string, string>(((existentes ?? []) as any[]).map((x) => [String(x.nombre).toLowerCase(), x.id as string] as [string, string]));
  const nuevas = [...nombres].filter(([n]) => !idDe.has(n.toLowerCase()));
  if (nuevas.length) {
    const { data: creadas, error } = await supabase
      .from("maquina")
      .insert(nuevas.map(([nombre, marca]) => ({ nombre, marca: marca && !/arriendo/i.test(marca) ? marca : null, tipo: tipoMaquina(nombre), propia: !(marca && /arriendo/i.test(marca)) })))
      .select("id, nombre");
    if (error) return { error: "No se pudieron crear las máquinas." };
    for (const x of (creadas ?? []) as any[]) idDe.set(String(x.nombre).toLowerCase(), x.id);
  }

  const fechas = movs.map((m) => m.fecha).sort();
  const { data: carga, error: eCarga } = await supabase
    .from("carga_petroleo")
    .insert({
      archivo: archivo.name,
      desde: fechas[0],
      hasta: fechas[fechas.length - 1],
      entradas: movs.filter((m) => m.tipo === "entrada").length,
      salidas: movs.filter((m) => m.tipo === "salida").length,
      subido_por: user.id,
    })
    .select("id")
    .single();
  if (eCarga || !carga) return { error: "No se pudo registrar la carga." };

  const filas = movs.map((m) => ({
    carga_id: carga.id,
    origen: "archivo",
    fecha: m.fecha,
    tipo: m.tipo,
    maquina_id: m.maquina ? idDe.get(m.maquina.toLowerCase()) ?? null : null,
    operario: m.operario,
    cuartel_codigo: m.cuartel,
    especie: m.especie,
    variedad: m.variedad,
    labor: m.labor,
    sublabor: m.sublabor,
    litros: Math.round(m.litros * 100) / 100,
    precio_lt: m.precio,
    horometro: m.horometro,
    km: m.km,
    medidor: m.medidor,
    hora: m.hora,
    factura: m.factura,
    proveedor: m.proveedor,
    creado_por: user.id,
  }));
  for (let i = 0; i < filas.length; i += LOTE) {
    const { error } = await supabase.from("mov_petroleo").insert(filas.slice(i, i + LOTE));
    if (error) {
      await supabase.from("carga_petroleo").delete().eq("id", carga.id);
      return { error: "Falló la carga de los movimientos. No se guardó nada; intenta de nuevo." };
    }
  }

  // El archivo es acumulado: reemplaza lo de cargas anteriores
  const { data: viejas } = await supabase.from("carga_petroleo").select("id").eq("estado", "vigente").neq("id", carga.id);
  const ids = ((viejas ?? []) as any[]).map((v) => v.id as string);
  if (ids.length) {
    await supabase.from("mov_petroleo").delete().in("carga_id", ids);
    await supabase.from("carga_petroleo").update({ estado: "reemplazada" }).in("id", ids);
  }

  revalidatePath("/maquinaria", "layout");
  const sal = movs.filter((m) => m.tipo === "salida");
  const ent = movs.filter((m) => m.tipo === "entrada");
  return {
    ok: `Petróleo cargado: ${num(sal.length)} salidas (${num(sal.reduce((s, m) => s + m.litros, 0))} L) y ${num(ent.length)} cargas al estanque (${num(ent.reduce((s, m) => s + m.litros, 0))} L) de ${num(nombres.size)} máquinas.${lectura.avisos.length ? " Ojo: " + lectura.avisos.join(" ") : ""}`,
  };
}
