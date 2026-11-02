"use server";
import { revalidatePath } from "next/cache";
import { exigirRol } from "@/lib/auth";
import { leerNumero, leerTexto } from "@/lib/formato";
import type { EstadoFormulario } from "@/components/Aviso";

export async function guardarCampo(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const id = leerTexto(form.get("id"));
  const sup = leerNumero(form.get("superficie_total_ha"));
  if (sup !== null && sup < 0) return { error: "La superficie no puede ser negativa." };
  const datos = {
    nombre: leerTexto(form.get("nombre")) ?? "Fundo La Morera",
    razon_social: leerTexto(form.get("razon_social")),
    rut: leerTexto(form.get("rut")),
    direccion: leerTexto(form.get("direccion")),
    comuna: leerTexto(form.get("comuna")),
    region: leerTexto(form.get("region")),
    superficie_total_ha: sup,
    infraestructura: leerTexto(form.get("infraestructura")),
    instalaciones_riego: leerTexto(form.get("instalaciones_riego")),
    observaciones: leerTexto(form.get("observaciones")),
  };
  const { error } = id ? await supabase.from("campo").update(datos).eq("id", id) : await supabase.from("campo").insert(datos);
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/campo");
  revalidatePath("/");
  return { ok: "Datos del campo guardados." };
}

export async function crearTemporada(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_administrativo");
  const nombre = leerTexto(form.get("nombre"));
  const inicio = leerTexto(form.get("inicio"));
  const termino = leerTexto(form.get("termino"));
  if (!nombre || !inicio || !termino) return { error: "Completa nombre, inicio y término." };
  if (inicio >= termino) return { error: "El término debe ser posterior al inicio." };
  const { error } = await supabase.from("temporada").insert({ nombre, inicio, termino });
  if (error) {
    if (error.code === "23P01") return { error: "Las fechas se traslapan con otra temporada." };
    if (error.code === "23505") return { error: "Ya existe una temporada con ese nombre." };
    return { error: "No se pudo crear la temporada." };
  }
  revalidatePath("/campo");
  revalidatePath("/");
  return { ok: `Temporada ${nombre} creada.` };
}

export async function crearCentroCosto(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_administrativo");
  const codigo = leerTexto(form.get("codigo"))?.toUpperCase();
  const nombre = leerTexto(form.get("nombre"));
  if (!codigo || !nombre) return { error: "Completa código y nombre." };
  const { error } = await supabase.from("centro_costo").insert({ codigo, nombre, tipo: "general" });
  if (error) return { error: error.code === "23505" ? "Ese código ya existe." : "No se pudo crear el centro de costo." };
  revalidatePath("/campo");
  return { ok: `Centro de costo ${codigo} creado.` };
}

export async function crearEspecie(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const nombre = leerTexto(form.get("nombre"));
  const grupo = leerTexto(form.get("grupo"));
  if (!nombre) return { error: "Escribe el nombre de la especie." };
  const { error } = await supabase.from("especie").insert({ nombre, grupo });
  if (error) return { error: error.code === "23505" ? "Esa especie ya existe." : "No se pudo crear la especie." };
  revalidatePath("/campo");
  return { ok: `Especie ${nombre} creada.` };
}

export async function crearVariedad(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const especie_id = leerTexto(form.get("especie_id"));
  const nombre = leerTexto(form.get("nombre"));
  if (!especie_id || !nombre) return { error: "Elige la especie y escribe la variedad." };
  const { error } = await supabase.from("variedad").insert({ especie_id, nombre });
  if (error) return { error: error.code === "23505" ? "Esa variedad ya existe para la especie." : "No se pudo crear la variedad." };
  revalidatePath("/campo");
  return { ok: `Variedad ${nombre} creada.` };
}
