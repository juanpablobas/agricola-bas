"use server";
// Acciones de una labor: crear/editar, cambiar estado, reprogramar (con motivo), avances, pago, comentarios y archivos.
// El historial solo se agrega (nunca se borra ni se corrige).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol, puede } from "@/lib/auth";
import { leerNumero, leerTexto } from "@/lib/formato";
import { esFecha, hoyChile, sumaDias } from "@/lib/semana";
import { costos, MOTIVOS, ESTADOS, type EstadoLabor } from "./modelo";
import { IVA, descontarPendientes, recalcularCostoInsumos } from "./insumos";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOpc = (v: FormDataEntryValue | null | undefined) => {
  const s = String(v ?? "");
  return UUID.test(s) ? s : null;
};
const ROLES = ["administrador", "enc_administrativo", "enc_agricola"] as const;
const ESTADOS_VALIDOS = Object.keys(ESTADOS) as EstadoLabor[];
const MOTIVOS_VALIDOS = MOTIVOS.map(([k]) => k as string);

/** "8", "8 personas" → 8 */
const numeroLibre = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const m = s.match(/\d+([.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : NaN;
};
/** Montos en pesos: "$480.000" → 480000 */
const pesos = (v: FormDataEntryValue | null) => {
  const d = String(v ?? "").replace(/[^\d]/g, "");
  return d === "" ? null : Number(d);
};
/** Campo "cuartel": un cuartel, "v:<variedad>" (variedad completa) o vacío (general) */
const lugar = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  if (s.startsWith("v:")) return { cuartel_id: null, variedad_id: idOpc(s.slice(2)) };
  return { cuartel_id: idOpc(s), variedad_id: null };
};
const esRedireccion = (e: unknown) => !!e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT");

async function historial(supabase: any, fila: Record<string, unknown>) {
  const { error } = await supabase.from("labor_historial").insert(fila);
  if (error) console.error("labor_historial", error);
}

function refrescar(id?: string) {
  revalidatePath("/labores", "layout");
  revalidatePath("/");
  if (id) revalidatePath(`/labores/${id}`);
}

/** Guarda la mano de obra (propia o del contratista) en labor_pago, que usan el resumen y la historia del cuartel */
async function guardarMontoMO(supabase: any, laborId: string, mo: number, edicion: boolean) {
  if (mo > 0) {
    const { error } = await supabase.from("labor_pago").upsert({ registro_id: laborId, monto: Math.round(mo) }, { onConflict: "registro_id" });
    return error;
  }
  if (edicion) await supabase.from("labor_pago").delete().eq("registro_id", laborId);
  return null;
}

export type EstadoLaborForm = { error?: string; valores?: Record<string, string> } | null;

const CAMPOS_COMPARAR: [string, string][] = [
  ["labor_tipo_id", "labor"], ["cuartel_id", "cuartel"], ["variedad_id", "variedad"], ["fecha", "fecha"], ["cuadrilla_id", "cuadrilla o contratista"],
  ["fiscalizador_id", "fiscalizador"], ["personas", "personas"], ["jornadas", "jornadas"], ["cantidad_plan", "cantidad planificada"],
  ["cantidad_ejecutada", "cantidad ejecutada"], ["ejecucion", "modalidad"], ["precio_unitario", "precio"], ["valor_jornal", "valor jornal"],
  ["estado_pago", "estado de pago"], ["presupuesto", "presupuesto"], ["observacion", "observación"],
];

/** Crear o editar una labor */
export async function guardarLabor(_: EstadoLaborForm, form: FormData): Promise<EstadoLaborForm> {
  const valores: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (!k.startsWith("$")) valores[k] = k in valores ? `${valores[k]},${String(v)}` : String(v);
  const fallo = (error: string): EstadoLaborForm => ({ error, valores });
  let destino = "/labores";
  try {
    const { supabase, user, perfil } = await exigirRol(...ROLES);
    const conMonto = puede(perfil.rol, "administrador", "enc_administrativo");
    const hoy = hoyChile();
    const id = idOpc(form.get("id"));
    const { data: antes } = id ? await supabase.from("labor_registro").select("*").eq("id", id).maybeSingle() : { data: null as any };
    if (id && !antes) return fallo("No se encontró la labor. Puede que la hayan borrado.");

    const estadoPedido = String(form.get("estado") ?? "programado") as EstadoLabor;
    if (!ESTADOS_VALIDOS.includes(estadoPedido)) return fallo("Estado no válido.");
    const fecha = String(form.get("fecha") ?? "").trim();
    const labor = idOpc(form.get("labor"));
    const ejecucion = form.get("ejecucion") === "contratista" ? "contratista" : "propio";
    const trabajadores = form.getAll("trabajadores").map((t) => idOpc(t)).filter(Boolean) as string[];
    let personas = numeroLibre(form.get("personas"));
    const diasTxt = String(form.get("dias") ?? "").trim();
    const dias = diasTxt === "" ? null : leerNumero(diasTxt);
    const horas = numeroLibre(form.get("horas"));
    const cantidadPlan = numeroLibre(form.get("cantidad_plan"));
    let cantidadEj = numeroLibre(form.get("cantidad_ejecutada"));
    const unidad = String(form.get("unidad_cantidad") ?? "") || null;
    const cobro = ejecucion === "contratista" ? String(form.get("cobro") ?? "") || null : null;
    let fechaInicio = String(form.get("fecha_inicio") ?? "").trim() || null;
    let fechaTermino = String(form.get("fecha_termino") ?? "").trim() || null;
    const motivo = String(form.get("motivo_cambio") ?? "");

    if (!esFecha(fecha)) return fallo("Falta la fecha de la labor.");
    if (fecha > sumaDias(hoy, 366)) return fallo("Revisa la fecha: está a más de un año.");
    if (!labor) return fallo("Falta elegir la labor (por ejemplo Poda o Raleo).");
    if (personas !== null && (!Number.isInteger(personas) || personas < 1 || personas > 500)) return fallo("Revisa las personas: un número entero, por ejemplo 8.");
    if (personas === null && trabajadores.length > 0) personas = trabajadores.length;
    if (dias !== null && (!(dias > 0) || dias > 62)) return fallo("Revisa los días: 1 si es un día completo, 0,5 si es medio día.");
    if (horas !== null && (Number.isNaN(horas) || horas <= 0 || horas > 5000)) return fallo("Revisa las horas trabajadas.");
    if (cantidadPlan !== null && (Number.isNaN(cantidadPlan) || cantidadPlan < 0)) return fallo("Revisa la cantidad planificada.");
    if (cantidadEj !== null && (Number.isNaN(cantidadEj) || cantidadEj < 0)) return fallo("Revisa la cantidad ejecutada.");
    if (unidad && !["ha", "arbol", "hilera", "jornada", "unidad"].includes(unidad)) return fallo("Unidad no válida.");
    if (cobro && !["ha", "arbol", "jornada", "unidad", "fijo"].includes(cobro)) return fallo("Modalidad de cobro no válida.");
    if (fechaInicio && !esFecha(fechaInicio)) return fallo("Revisa la fecha de inicio.");
    if (fechaTermino && !esFecha(fechaTermino)) return fallo("Revisa la fecha de término.");

    // Estado al guardar: al editar se mantiene, salvo que se esté confirmando que se hizo
    let estado: EstadoLabor = id ? (antes.estado as EstadoLabor) : estadoPedido;
    if (id && form.get("confirmar") === "1") estado = "realizado";
    if (id && estadoPedido !== antes.estado && form.get("cambiar_estado") === "1") estado = estadoPedido;

    if (estado === "realizado" || estado === "en_ejecucion") {
      if (!fechaInicio) fechaInicio = fecha <= hoy ? fecha : hoy;
      if (fechaInicio > hoy) return fallo("La fecha de inicio no puede ser un día que todavía no llega.");
    }
    if (estado === "realizado") {
      if (!fechaTermino) fechaTermino = fecha <= hoy ? fecha : hoy;
      if (fechaTermino > hoy) return fallo("Si ya se hizo, la fecha de término no puede ser un día que todavía no llega. Cambia la fecha o déjala como pendiente.");
      if (fechaInicio && fechaTermino < fechaInicio) return fallo("La fecha de término no puede ser antes del inicio.");
      if (ejecucion === "propio" && personas === null && horas === null) return fallo("Falta indicar cuántas personas trabajaron (o elegir los trabajadores).");
      if (cantidadEj === null && cantidadPlan !== null) cantidadEj = cantidadPlan;
    }

    // Jornadas: personas × días (o horas ÷ 8); si el contratista cobra por jornada, la cantidad son las jornadas
    let jornadas: number | null = null;
    if (personas !== null) jornadas = Math.round(personas * (dias ?? 1) * 100) / 100;
    else if (horas !== null) jornadas = Math.round((horas / 8) * 100) / 100;
    if (ejecucion === "contratista" && cobro === "jornada" && (cantidadEj ?? cantidadPlan) !== null) jornadas = cantidadEj ?? cantidadPlan;

    // Una fecha cambiada en algo pendiente es una reprogramación: pide motivo y conserva la fecha original
    const cambioFecha = !!id && antes.fecha !== fecha;
    const pendiente = estado === "programado" || estado === "reprogramado";
    if (cambioFecha && pendiente) {
      if (!MOTIVOS_VALIDOS.includes(motivo)) return fallo("Cambiaste la fecha: elige el motivo de la reprogramación.");
      estado = "reprogramado";
    }

    const datos: Record<string, unknown> = {
      estado, fecha, ...lugar(form.get("cuartel")), labor_tipo_id: labor, ejecucion,
      cuadrilla_id: idOpc(form.get(ejecucion === "contratista" ? "contratista" : "cuadrilla")),
      fiscalizador_id: idOpc(form.get("fiscalizador")),
      personas, jornadas, horas,
      modalidad: ejecucion === "contratista" && cobro !== "jornada" ? "trato" : "dia",
      cantidad_plan: cantidadPlan, cantidad_ejecutada: cantidadEj, unidad_cantidad: unidad,
      cobro, fecha_inicio: fechaInicio, fecha_termino: estado === "realizado" ? fechaTermino : null,
      documento: leerTexto(form.get("documento")),
      observacion: leerTexto(form.get("observacion")),
    };
    if (conMonto) {
      Object.assign(datos, {
        valor_jornal: ejecucion === "propio" ? pesos(form.get("valor_jornal")) : null,
        valor_hora: ejecucion === "propio" ? pesos(form.get("valor_hora")) : null,
        precio_unitario: ejecucion === "contratista" ? pesos(form.get("precio_unitario")) : null,
        estado_pago: ["pendiente", "parcial", "pagado"].includes(String(form.get("estado_pago"))) ? String(form.get("estado_pago")) : "pendiente",
        monto_pagado: pesos(form.get("monto_pagado")),
        costo_maquinaria: pesos(form.get("costo_maquinaria")),
        costo_insumos: pesos(form.get("costo_insumos")),
      });
      const presupuesto = pesos(form.get("presupuesto"));
      // Si no se indica presupuesto, se calcula con lo planificado (útil para comparar después)
      datos.presupuesto = presupuesto ?? (costos({ ...(datos as any), cantidad_ejecutada: null }, true).total || null);
    }
    if (estado === "realizado" && (!antes || antes.estado !== "realizado")) Object.assign(datos, { confirmado_por: user.id, confirmado_en: new Date().toISOString() });

    let laborId = id;
    if (id) {
      const { error } = await supabase.from("labor_registro").update(datos).eq("id", id);
      if (error) {
        console.error("guardarLabor update", error);
        return fallo(`No se pudo guardar (${error.message}).`);
      }
    } else {
      const { data: nueva, error } = await supabase
        .from("labor_registro")
        .insert({ ...datos, fecha_original: fecha, plan_id: idOpc(form.get("plan")), creado_por: user.id })
        .select("id")
        .single();
      if (error || !nueva) {
        console.error("guardarLabor insert", error);
        return fallo(`No se pudo guardar la labor${error?.message ? ` (${error.message})` : ""}.`);
      }
      laborId = nueva.id;
    }

    // Trabajadores propios
    if (laborId) {
      await supabase.from("labor_trabajador").delete().eq("labor_id", laborId);
      if (ejecucion === "propio" && trabajadores.length) {
        const { error: et } = await supabase.from("labor_trabajador").insert(trabajadores.map((t) => ({ labor_id: laborId, trabajador_id: t })));
        if (et) console.error("labor_trabajador", et);
      }
    }

    // Mano de obra en labor_pago (compatibilidad con resumen e historia del cuartel)
    if (conMonto && laborId) {
      const c = costos(datos as any);
      const e2 = await guardarMontoMO(supabase, laborId, c.propia + c.externa, !!id);
      if (e2) console.error("labor_pago", e2);
    }

    // Insumos de bodega: si la labor ya empezó o terminó, se descuentan los pendientes
    let faltanInsumos: string[] = [];
    if (laborId) {
      faltanInsumos = await descontarPendientes(supabase, laborId, user.id);
      await recalcularCostoInsumos(supabase, laborId);
    }

    // Historial
    if (!id) {
      await historial(supabase, { labor_id: laborId, tipo: "creada", estado_despues: estado, fecha_despues: fecha, usuario: user.id, detalle: ESTADOS[estado].texto });
    } else {
      if (cambioFecha) {
        await historial(supabase, {
          labor_id: id, tipo: "fecha", fecha_antes: antes.fecha, fecha_despues: fecha, estado_antes: antes.estado, estado_despues: estado,
          motivo: pendiente || estado === "reprogramado" ? motivo || null : null, detalle: leerTexto(form.get("obs_cambio")) ?? (pendiente ? null : "Fecha corregida"), usuario: user.id,
        });
      } else if (antes.estado !== estado) {
        await historial(supabase, { labor_id: id, tipo: "estado", estado_antes: antes.estado, estado_despues: estado, usuario: user.id });
      }
      const cambios = CAMPOS_COMPARAR.filter(([k]) => k !== "fecha" && String(antes[k] ?? "") !== String((datos as any)[k] ?? "")).map(([, t]) => t);
      const responsables = ["cuadrilla o contratista", "fiscalizador"].filter((t) => cambios.includes(t));
      if (responsables.length) await historial(supabase, { labor_id: id, tipo: "responsable", detalle: `Cambió: ${responsables.join(", ")}`, usuario: user.id });
      const otros = cambios.filter((t) => !responsables.includes(t));
      if (otros.length) await historial(supabase, { labor_id: id, tipo: "edicion", detalle: `Editó: ${otros.join(", ")}`, usuario: user.id });
    }

    refrescar(laborId ?? undefined);
    destino = `/labores/${laborId}?ok=${id ? "editada" : "creada"}${faltanInsumos.length ? `&sinstock=${encodeURIComponent(faltanInsumos.join(", "))}` : ""}`;
  } catch (e) {
    if (esRedireccion(e)) throw e;
    console.error("guardarLabor excepción", e);
    return fallo("Algo falló al guardar. Revisa tu conexión e intenta de nuevo.");
  }
  redirect(destino);
}

/** Cambia el estado desde la ficha (iniciar, realizar, cancelar, reabrir). Reprogramar va aparte porque pide motivo. */
export async function cambiarEstado(form: FormData) {
  const { supabase, user } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const nuevo = String(form.get("estado") ?? "") as EstadoLabor;
  const volver = String(form.get("volver") ?? "");
  if (!id || !ESTADOS_VALIDOS.includes(nuevo) || nuevo === "reprogramado") redirect("/labores");
  const { data: l } = await supabase.from("labor_registro").select("estado, fecha, fecha_inicio, ejecucion, personas, horas, cantidad_plan, cantidad_ejecutada").eq("id", id).maybeSingle();
  if (!l) redirect("/labores");
  const hoy = hoyChile();
  if (nuevo === "realizado") {
    // Falta información para darla por hecha: se abre el formulario para completarla
    if ((l.ejecucion === "propio" && l.personas == null && l.horas == null) || l.fecha > hoy) redirect(`/labores/registro/${id}?hecho=1`);
  }
  const datos: Record<string, unknown> = { estado: nuevo };
  if (nuevo === "en_ejecucion" && !l.fecha_inicio) datos.fecha_inicio = hoy;
  if (nuevo === "realizado") {
    Object.assign(datos, {
      fecha_inicio: l.fecha_inicio ?? (l.fecha <= hoy ? l.fecha : hoy),
      fecha_termino: hoy,
      cantidad_ejecutada: l.cantidad_ejecutada != null && l.cantidad_plan != null && Number(l.cantidad_ejecutada) > Number(l.cantidad_plan) ? l.cantidad_ejecutada : l.cantidad_plan ?? l.cantidad_ejecutada,
      confirmado_por: user.id,
      confirmado_en: new Date().toISOString(),
    });
  }
  if (nuevo === "programado") Object.assign(datos, { fecha_termino: null });
  await supabase.from("labor_registro").update(datos).eq("id", id);
  await historial(supabase, { labor_id: id, tipo: "estado", estado_antes: l.estado, estado_despues: nuevo, detalle: leerTexto(form.get("observacion")), usuario: user.id });
  const faltan = await descontarPendientes(supabase, id!, user.id);
  refrescar(id);
  revalidatePath("/inventario", "layout");
  if (faltan.length) redirect(`/labores/${id}?ok=estado&sinstock=${encodeURIComponent(faltan.join(", "))}`);
  redirect(volver.startsWith("/labores") ? volver : `/labores/${id}?ok=estado`);
}

/** Reprogramar: motivo, nueva fecha y observaciones. La fecha original se conserva. */
export async function reprogramar(form: FormData) {
  const { supabase, user } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const nueva = String(form.get("nueva_fecha") ?? "");
  const motivo = String(form.get("motivo") ?? "");
  if (!id) redirect("/labores");
  if (!esFecha(nueva) || !MOTIVOS_VALIDOS.includes(motivo)) redirect(`/labores/${id}?error=reprogramar`);
  const { data: l } = await supabase.from("labor_registro").select("estado, fecha").eq("id", id).maybeSingle();
  if (!l) redirect("/labores");
  await supabase.from("labor_registro").update({ estado: "reprogramado", fecha: nueva }).eq("id", id);
  await historial(supabase, {
    labor_id: id, tipo: "fecha", estado_antes: l.estado, estado_despues: "reprogramado", fecha_antes: l.fecha, fecha_despues: nueva,
    motivo, detalle: leerTexto(form.get("observacion")), usuario: user.id,
  });
  refrescar(id);
  const volver = String(form.get("volver") ?? "");
  redirect(volver.startsWith("/labores") ? volver : `/labores/${id}?ok=reprogramada`);
}

/** Avance parcial: suma a lo ejecutado; si llega al 100 % se puede dar por realizada */
export async function registrarAvance(form: FormData) {
  const { supabase, user } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const fecha = String(form.get("fecha") ?? "");
  const cantidad = numeroLibre(form.get("cantidad"));
  if (!id) redirect("/labores");
  if (!esFecha(fecha) || fecha > hoyChile() || cantidad === null || Number.isNaN(cantidad) || cantidad <= 0) redirect(`/labores/${id}?error=avance`);
  const { data: l } = await supabase.from("labor_registro").select("estado, cantidad_ejecutada, cantidad_plan, fecha_inicio, unidad_cantidad").eq("id", id).maybeSingle();
  if (!l) redirect("/labores");
  const total = Math.round((Number(l.cantidad_ejecutada ?? 0) + cantidad) * 100) / 100;
  const { error } = await supabase.from("labor_avance").insert({ labor_id: id, fecha, cantidad, observacion: leerTexto(form.get("observacion")), creado_por: user.id });
  if (error) redirect(`/labores/${id}?error=avance`);
  const datos: Record<string, unknown> = { cantidad_ejecutada: total };
  if (l.estado === "programado" || l.estado === "reprogramado") Object.assign(datos, { estado: "en_ejecucion", fecha_inicio: l.fecha_inicio ?? fecha });
  await supabase.from("labor_registro").update(datos).eq("id", id);
  const plan = Number(l.cantidad_plan ?? 0);
  await historial(supabase, {
    labor_id: id, tipo: "avance", estado_antes: l.estado, estado_despues: (datos.estado as string) ?? l.estado,
    detalle: `+${cantidad} (total ${total}${plan > 0 ? ` de ${plan}, ${Math.min(100, Math.round((total / plan) * 100))} %` : ""})`, usuario: user.id,
  });
  refrescar(id);
  redirect(`/labores/${id}?ok=avance${plan > 0 && total >= plan ? "_completo" : ""}`);
}

export async function actualizarPago(form: FormData) {
  const { supabase, user } = await exigirRol("administrador", "enc_administrativo");
  const id = idOpc(form.get("id"));
  const estado = String(form.get("estado_pago") ?? "");
  if (!id || !["pendiente", "parcial", "pagado"].includes(estado)) redirect("/labores");
  const datos = { estado_pago: estado, monto_pagado: pesos(form.get("monto_pagado")), documento: leerTexto(form.get("documento")) };
  await supabase.from("labor_registro").update(datos).eq("id", id);
  await historial(supabase, { labor_id: id, tipo: "pago", detalle: `Pago ${estado}${datos.monto_pagado ? ` · $${datos.monto_pagado.toLocaleString("es-CL")}` : ""}${datos.documento ? ` · doc. ${datos.documento}` : ""}`, usuario: user.id });
  refrescar(id);
  redirect(`/labores/${id}?ok=pago`);
}

export async function comentarFiscalizador(form: FormData) {
  const { supabase, user } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const texto = leerTexto(form.get("comentario"));
  if (!id) redirect("/labores");
  await supabase.from("labor_registro").update({ comentario_fiscalizador: texto }).eq("id", id);
  await historial(supabase, { labor_id: id, tipo: "comentario", detalle: texto ? `Comentario del fiscalizador: ${texto.slice(0, 200)}` : "Comentario borrado", usuario: user.id });
  refrescar(id);
  redirect(`/labores/${id}?ok=comentario`);
}

export async function borrarAvance(form: FormData) {
  const { supabase, user } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const laborId = idOpc(form.get("labor_id"));
  if (!id || !laborId) redirect("/labores");
  const { data: a } = await supabase.from("labor_avance").select("cantidad").eq("id", id).maybeSingle();
  const { data: l } = await supabase.from("labor_registro").select("cantidad_ejecutada").eq("id", laborId).maybeSingle();
  if (a && l) {
    await supabase.from("labor_avance").delete().eq("id", id);
    const total = Math.max(0, Math.round((Number(l.cantidad_ejecutada ?? 0) - Number(a.cantidad)) * 100) / 100);
    await supabase.from("labor_registro").update({ cantidad_ejecutada: total }).eq("id", laborId);
    await historial(supabase, { labor_id: laborId, tipo: "avance", detalle: `Se quitó un avance de ${a.cantidad} (total ${total})`, usuario: user.id });
  }
  refrescar(laborId);
  redirect(`/labores/${laborId}`);
}

export async function borrarLabor(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  if (id) await supabase.from("labor_registro").delete().eq("id", id);
  refrescar();
  redirect("/labores?ok=borrada");
}

/** Archivos (fotos y documentos) de una labor: usa el mismo almacenamiento que los cuarteles */
export async function registrarArchivoLabor(datos: { ruta: string; nombre: string; mime: string; bytes: number; entidad: string; entidad_id: string; descripcion?: string | null }) {
  const { supabase } = await exigirRol(...ROLES);
  if (datos.entidad !== "labor" || !idOpc(datos.entidad_id) || !datos.ruta.startsWith(`labor/${datos.entidad_id}/`)) return { error: "Ruta de archivo no válida." };
  const { error } = await supabase.from("archivo").insert(datos);
  if (error) return { error: "El archivo se subió, pero no se pudo registrar." };
  revalidatePath(`/labores/${datos.entidad_id}`);
  return { ok: "Archivo agregado." };
}

export async function borrarArchivoLabor(form: FormData) {
  const { supabase } = await exigirRol("administrador");
  const id = idOpc(form.get("id"));
  if (!id) return;
  const { data: a } = await supabase.from("archivo").select("ruta, entidad_id").eq("id", id).single();
  if (!a) return;
  await supabase.storage.from("archivos").remove([a.ruta]);
  await supabase.from("archivo").delete().eq("id", id);
  revalidatePath(`/labores/${a.entidad_id}`);
}

/** Agrega un insumo de bodega a la labor. Si la labor ya empezó o terminó, se descuenta al tiro; si no, cuando se haga. */
export async function agregarInsumo(form: FormData) {
  const { supabase, user } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const producto = idOpc(form.get("producto"));
  let cantidad = numeroLibre(form.get("cantidad"));
  const porHa = form.get("por_ha") === "1";
  const descontar = form.get("descontar") === "1";
  if (!id) redirect("/labores");
  if (!producto || cantidad === null || Number.isNaN(cantidad) || cantidad <= 0) redirect(`/labores/${id}?error=insumo#insumos`);
  if (porHa) {
    const ha = numeroLibre(form.get("ha"));
    if (!ha || Number.isNaN(ha)) redirect(`/labores/${id}?error=insumo_ha#insumos`);
    cantidad = Math.round(cantidad * ha * 10000) / 10000;
  }
  const { data: st } = await supabase.from("v_stock").select("nombre, unidad, stock, costo_promedio").eq("producto_id", producto).maybeSingle();
  if (!st) redirect(`/labores/${id}?error=insumo#insumos`);
  const { data: l } = await supabase.from("labor_registro").select("estado").eq("id", id).maybeSingle();
  if (!l) redirect("/labores");
  const yaSeHace = l.estado === "en_ejecucion" || l.estado === "realizado";
  if (descontar && yaSeHace && cantidad > Number(st.stock) + 0.0005) {
    redirect(`/labores/${id}?sinstock=${encodeURIComponent(`${st.nombre} (hay ${Number(st.stock).toLocaleString("es-CL")} ${st.unidad ?? ""})`)}#insumos`);
  }
  const { error } = await supabase.from("labor_insumo").insert({
    labor_id: id, producto_id: producto, cantidad, descontar,
    costo_unitario: st.costo_promedio != null ? Math.round(Number(st.costo_promedio) * IVA * 100) / 100 : null,
    observacion: leerTexto(form.get("observacion")), creado_por: user.id,
  });
  if (error) {
    console.error("agregarInsumo", error);
    redirect(`/labores/${id}?error=insumo#insumos`);
  }
  const faltan = await descontarPendientes(supabase, id!, user.id);
  await recalcularCostoInsumos(supabase, id!);
  await historial(supabase, { labor_id: id, tipo: "insumo", detalle: `+ ${cantidad.toLocaleString("es-CL")} ${st.unidad ?? ""} de ${st.nombre}${descontar ? (yaSeHace ? " (descontado de bodega)" : " (se descuenta cuando se haga)") : " (sin descontar)"}`, usuario: user.id });
  refrescar(id!);
  revalidatePath("/inventario", "layout");
  redirect(`/labores/${id}?ok=insumo${faltan.length ? `&sinstock=${encodeURIComponent(faltan.join(", "))}` : ""}#insumos`);
}

/** Quita un insumo de la labor; si ya se había descontado, el producto vuelve a la bodega. */
export async function quitarInsumo(form: FormData) {
  const { supabase, user } = await exigirRol(...ROLES);
  const insumo = idOpc(form.get("insumo"));
  const id = idOpc(form.get("id"));
  if (!insumo || !id) redirect("/labores");
  const { data: x } = await supabase.from("labor_insumo").select("mov_id, cantidad, producto(nombre, unidad)").eq("id", insumo).maybeSingle();
  if (x?.mov_id) {
    const { error } = await supabase.from("mov_inventario").delete().eq("id", x.mov_id);
    if (error) redirect(`/labores/${id}?error=insumo_quitar#insumos`);
  }
  await supabase.from("labor_insumo").delete().eq("id", insumo);
  const { count } = await supabase.from("labor_insumo").select("id", { count: "exact", head: true }).eq("labor_id", id);
  if (!count) await supabase.from("labor_registro").update({ costo_insumos: null }).eq("id", id);
  else await recalcularCostoInsumos(supabase, id);
  if (x) await historial(supabase, { labor_id: id, tipo: "insumo", detalle: `− ${Number(x.cantidad).toLocaleString("es-CL")} ${(x as any).producto?.unidad ?? ""} de ${(x as any).producto?.nombre ?? "producto"}${x.mov_id ? " (devuelto a bodega)" : ""}`, usuario: user.id });
  refrescar(id);
  revalidatePath("/inventario", "layout");
  redirect(`/labores/${id}?ok=insumo_quitado#insumos`);
}
