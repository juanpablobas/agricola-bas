"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { leerNumero, leerTexto } from "@/lib/formato";
import type { EstadoFormulario } from "@/components/Aviso";

type Supa = Awaited<ReturnType<typeof exigirRol>>["supabase"];

/** Interpreta el selector "Especie y variedad" (esp:<id> o var:<id>) y crea la variedad nueva si se escribió una. */
async function resolverPlantacion(supabase: Supa, form: FormData) {
  const sel = String(form.get("plantacion") ?? "");
  const nueva = leerTexto(form.get("variedad_nueva"));
  if (!sel) return { error: "Elige la especie y variedad." } as const;

  if (sel.startsWith("var:")) {
    const variedadId = sel.slice(4);
    const { data: v } = await supabase.from("variedad").select("id, especie_id").eq("id", variedadId).single();
    if (!v) return { error: "La variedad elegida no existe." } as const;
    return { especieId: v.especie_id as string, variedadId: v.id as string } as const;
  }

  const especieId = sel.slice(4);
  if (!nueva) return { especieId, variedadId: null } as const;

  const { data: existente } = await supabase
    .from("variedad")
    .select("id")
    .eq("especie_id", especieId)
    .ilike("nombre", nueva)
    .maybeSingle();
  if (existente) return { especieId, variedadId: existente.id as string } as const;

  const { data: creada, error } = await supabase
    .from("variedad")
    .insert({ especie_id: especieId, nombre: nueva })
    .select("id")
    .single();
  if (error || !creada) return { error: "No se pudo crear la variedad nueva." } as const;
  return { especieId, variedadId: creada.id as string } as const;
}

function leerPeriodo(form: FormData) {
  const anio = leerNumero(form.get("anio_plantacion"));
  const plantas = leerNumero(form.get("plantas"));
  return {
    portainjerto: leerTexto(form.get("portainjerto")),
    anio_plantacion: anio === null ? null : Math.round(anio),
    distancia_hileras_m: leerNumero(form.get("distancia_hileras_m")),
    distancia_plantas_m: leerNumero(form.get("distancia_plantas_m")),
    plantas: plantas === null ? null : Math.round(plantas),
  };
}

function leerCuartel(form: FormData) {
  return {
    codigo: leerTexto(form.get("codigo")),
    nombre: leerTexto(form.get("nombre")),
    superficie_ha: leerNumero(form.get("superficie_ha")),
    estado_productivo: String(form.get("estado_productivo") ?? "productivo"),
    sistema_riego: leerTexto(form.get("sistema_riego")),
    observaciones: leerTexto(form.get("observaciones")),
  };
}

function validar(c: ReturnType<typeof leerCuartel>, p: ReturnType<typeof leerPeriodo>): string | null {
  if (!c.codigo) return "El cuartel necesita un código (por ejemplo 4-4b).";
  if (c.superficie_ha === null || c.superficie_ha <= 0) return "La superficie debe ser mayor que cero.";
  if (c.superficie_ha > 1000) return "Revisa la superficie: parece demasiado grande.";
  const anioActual = new Date().getFullYear();
  if (p.anio_plantacion !== null && (p.anio_plantacion < 1950 || p.anio_plantacion > anioActual + 1))
    return "Revisa el año de plantación.";
  if (p.plantas !== null && p.plantas < 0) return "El número de plantas no puede ser negativo.";
  return null;
}

async function guardarSectores(supabase: Supa, cuartelId: string, form: FormData) {
  const elegidos = form.getAll("sectores").map(String);
  const { data: actuales } = await supabase.from("cuartel_sector").select("sector_id").eq("cuartel_id", cuartelId);
  const ya = new Set((actuales ?? []).map((a) => a.sector_id as string));
  const quitar = [...ya].filter((s) => !elegidos.includes(s));
  const agregar = elegidos.filter((s) => !ya.has(s));
  if (quitar.length) await supabase.from("cuartel_sector").delete().eq("cuartel_id", cuartelId).in("sector_id", quitar);
  if (agregar.length) await supabase.from("cuartel_sector").insert(agregar.map((sector_id) => ({ cuartel_id: cuartelId, sector_id })));
}

function mensajeDuplicado(error: { code?: string; message?: string } | null) {
  if (error?.code === "23505") return "Ya existe un cuartel con ese código.";
  return "No se pudo guardar. Intenta de nuevo.";
}

export async function crearCuartel(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const c = leerCuartel(form);
  const p = leerPeriodo(form);
  const error = validar(c, p);
  if (error) return { error };
  const plant = await resolverPlantacion(supabase, form);
  if ("error" in plant) return { error: plant.error };

  const { data: nuevo, error: e1 } = await supabase.from("cuartel").insert(c).select("id").single();
  if (e1 || !nuevo) return { error: mensajeDuplicado(e1) };

  const { error: e2 } = await supabase.from("cuartel_periodo").insert({
    cuartel_id: nuevo.id,
    desde: leerTexto(form.get("desde")),
    especie_id: plant.especieId,
    variedad_id: plant.variedadId,
    motivo: "Alta del cuartel",
    ...p,
  });
  if (e2) return { error: "El cuartel se creó, pero no se pudo guardar su plantación. Revísalo en la ficha." };

  await guardarSectores(supabase, nuevo.id, form);
  revalidatePath("/cuarteles");
  revalidatePath("/");
  redirect(`/cuarteles/${nuevo.id}`);
}

export async function editarCuartel(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const id = String(form.get("id"));
  const periodoId = leerTexto(form.get("periodo_id"));
  const c = leerCuartel(form);
  const p = leerPeriodo(form);
  const error = validar(c, p);
  if (error) return { error };
  const plant = await resolverPlantacion(supabase, form);
  if ("error" in plant) return { error: plant.error };

  const { error: e1 } = await supabase.from("cuartel").update(c).eq("id", id);
  if (e1) return { error: mensajeDuplicado(e1) };

  const datosPeriodo = { especie_id: plant.especieId, variedad_id: plant.variedadId, ...p };
  const { error: e2 } = periodoId
    ? await supabase.from("cuartel_periodo").update(datosPeriodo).eq("id", periodoId)
    : await supabase.from("cuartel_periodo").insert({ cuartel_id: id, motivo: "Alta de plantación", ...datosPeriodo });
  if (e2) return { error: "Se guardó el cuartel, pero no los datos de plantación." };

  await guardarSectores(supabase, id, form);
  revalidatePath("/cuarteles");
  revalidatePath(`/cuarteles/${id}`);
  revalidatePath("/");
  redirect(`/cuarteles/${id}?ok=guardado`);
}

export async function cambiarPlantacion(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const id = String(form.get("id"));
  const desde = leerTexto(form.get("desde"));
  if (!desde) return { error: "Indica desde qué fecha rige la nueva plantación." };
  const p = leerPeriodo(form);
  const plant = await resolverPlantacion(supabase, form);
  if ("error" in plant) return { error: plant.error };

  const { error } = await supabase.rpc("nuevo_periodo_cuartel", {
    p_cuartel_id: id,
    p_desde: desde,
    p_especie_id: plant.especieId,
    p_variedad_id: plant.variedadId,
    p_portainjerto: p.portainjerto,
    p_anio_plantacion: p.anio_plantacion,
    p_distancia_hileras_m: p.distancia_hileras_m,
    p_distancia_plantas_m: p.distancia_plantas_m,
    p_plantas: p.plantas,
    p_motivo: leerTexto(form.get("motivo")) ?? "Cambio de plantación",
  });
  if (error) {
    if (error.message.includes("periodo_fechas")) return { error: "La fecha es anterior al inicio de la plantación vigente." };
    return { error: "No se pudo registrar el cambio de plantación." };
  }
  revalidatePath(`/cuarteles/${id}`);
  revalidatePath("/cuarteles");
  revalidatePath("/");
  redirect(`/cuarteles/${id}?ok=plantacion`);
}

export async function cambiarActivo(form: FormData) {
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const id = String(form.get("id"));
  const activo = form.get("activo") === "true";
  await supabase.from("cuartel").update({ activo }).eq("id", id);
  revalidatePath(`/cuarteles/${id}`);
  revalidatePath("/cuarteles");
  revalidatePath("/");
}

export async function registrarArchivo(datos: {
  ruta: string;
  nombre: string;
  mime: string;
  bytes: number;
  entidad: string;
  entidad_id: string;
  descripcion?: string | null;
}) {
  const { supabase } = await exigirRol("administrador", "enc_agricola", "enc_administrativo");
  if (!datos.ruta.startsWith(`${datos.entidad}/${datos.entidad_id}/`)) return { error: "Ruta de archivo no válida." };
  const { error } = await supabase.from("archivo").insert(datos);
  if (error) return { error: "El archivo se subió, pero no se pudo registrar." };
  revalidatePath(`/cuarteles/${datos.entidad_id}`);
  return { ok: "Archivo agregado." };
}

export async function borrarArchivo(form: FormData) {
  const { supabase } = await exigirRol("administrador");
  const id = String(form.get("id"));
  const { data: a } = await supabase.from("archivo").select("ruta, entidad_id").eq("id", id).single();
  if (!a) return;
  await supabase.storage.from("archivos").remove([a.ruta]);
  await supabase.from("archivo").delete().eq("id", id);
  revalidatePath(`/cuarteles/${a.entidad_id}`);
}
