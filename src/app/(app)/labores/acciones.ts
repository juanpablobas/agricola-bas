"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { leerTexto } from "@/lib/formato";
import { CATEGORIAS } from "./modelo";
import type { EstadoFormulario } from "@/components/Aviso";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOpc = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return UUID.test(s) ? s : null;
};
const ROLES = ["administrador", "enc_administrativo", "enc_agricola"] as const;


export async function crearCuadrilla(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol(...ROLES);
  const nombre = leerTexto(form.get("nombre"));
  const tipo = String(form.get("tipo") ?? "contratista");
  if (!nombre) return { error: "Escribe el nombre de la cuadrilla." };
  if (!["propia", "contratista"].includes(tipo)) return { error: "Tipo no válido." };
  const { error } = await supabase.from("cuadrilla").insert({ nombre, jefe: leerTexto(form.get("jefe")), tipo, telefono: leerTexto(form.get("telefono")), rut: leerTexto(form.get("rut")) });
  if (error) return { error: error.code === "23505" ? "Ya existe una cuadrilla con ese nombre." : "No se pudo guardar." };
  revalidatePath("/labores", "layout");
  return { ok: "Cuadrilla agregada." };
}

export async function crearLabor(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol(...ROLES);
  const nombre = leerTexto(form.get("nombre"));
  if (!nombre) return { error: "Escribe el nombre de la labor." };
  const categoria = CATEGORIAS.includes(String(form.get("categoria"))) ? String(form.get("categoria")) : "Otras";
  const { error } = await supabase.from("labor_tipo").insert({ nombre, categoria });
  if (error) return { error: error.code === "23505" ? "Ya existe esa labor." : "No se pudo guardar." };
  revalidatePath("/labores", "layout");
  return { ok: "Labor agregada." };
}

export async function crearTrabajador(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol(...ROLES);
  const nombre = leerTexto(form.get("nombre"));
  if (!nombre) return { error: "Escribe el nombre del trabajador." };
  const { error } = await supabase.from("trabajador").insert({ nombre, vive_en_campo: form.get("vive") === "on", telefono: leerTexto(form.get("telefono")) });
  if (error) return { error: error.code === "23505" ? "Ya existe un trabajador con ese nombre." : "No se pudo guardar." };
  revalidatePath("/labores", "layout");
  return { ok: "Trabajador agregado." };
}

export async function editarTrabajador(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const nombre = leerTexto(form.get("nombre"));
  if (!id || !nombre) redirect("/labores/catalogos?error=1");
  const { error } = await supabase.from("trabajador").update({ nombre, vive_en_campo: form.get("vive") === "on", telefono: leerTexto(form.get("telefono")), perfil_id: idOpc(form.get("perfil")) }).eq("id", id);
  if (error) redirect("/labores/catalogos?error=1");
  revalidatePath("/labores", "layout");
  redirect("/labores/catalogos?ok=1");
}

export async function borrarCatalogo(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const tabla = String(form.get("tabla") ?? "");
  const id = idOpc(form.get("id"));
  if (!id || !["cuadrilla", "labor_tipo", "trabajador"].includes(tabla)) redirect("/labores/catalogos?error=1");
  const { error } = await supabase.from(tabla).delete().eq("id", id);
  if (error) redirect(`/labores/catalogos?error=${error.code === "23503" ? "uso" : "1"}`);
  revalidatePath("/labores", "layout");
  redirect("/labores/catalogos?ok=1");
}

export async function alternarActivo(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const tabla = String(form.get("tabla") ?? "");
  const id = idOpc(form.get("id"));
  const activo = form.get("activo") === "true";
  if (id && (tabla === "cuadrilla" || tabla === "labor_tipo" || tabla === "trabajador")) await supabase.from(tabla).update({ activo: !activo }).eq("id", id);
  revalidatePath("/labores", "layout");
  redirect("/labores/catalogos");
}

/** Catálogo: categoría de la labor y especies a las que aplica (ninguna marcada = todas) */
export async function editarLaborTipo(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const nombre = leerTexto(form.get("nombre"));
  if (!id || !nombre) redirect("/labores/catalogos?error=1");
  const categoria = CATEGORIAS.includes(String(form.get("categoria"))) ? String(form.get("categoria")) : "Otras";
  const especies = form.getAll("especies").map((e) => idOpc(e)).filter(Boolean) as string[];
  const { error } = await supabase.from("labor_tipo").update({ nombre, categoria, especies: especies.length ? especies : null }).eq("id", id);
  if (error) redirect(`/labores/catalogos?error=${error.code === "23505" ? "repetida" : "1"}#labores`);
  revalidatePath("/labores", "layout");
  redirect("/labores/catalogos?ok=1#labores");
}

export async function editarCuadrilla(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const nombre = leerTexto(form.get("nombre"));
  const tipo = String(form.get("tipo") ?? "contratista");
  if (!id || !nombre || !["propia", "contratista"].includes(tipo)) redirect("/labores/catalogos?error=1");
  const { error } = await supabase.from("cuadrilla").update({ nombre, tipo, jefe: leerTexto(form.get("jefe")), telefono: leerTexto(form.get("telefono")), rut: leerTexto(form.get("rut")) }).eq("id", id);
  if (error) redirect("/labores/catalogos?error=1");
  revalidatePath("/labores", "layout");
  redirect("/labores/catalogos?ok=1");
}
