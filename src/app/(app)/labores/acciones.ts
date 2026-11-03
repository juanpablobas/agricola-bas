"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol, puede } from "@/lib/auth";
import { leerNumero, leerTexto } from "@/lib/formato";
import { esFecha, hoyChile, lunesDe } from "@/lib/semana";
import type { EstadoFormulario } from "@/components/Aviso";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOpc = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return UUID.test(s) ? s : null;
};
const ROLES = ["administrador", "enc_administrativo", "enc_agricola"] as const;

export async function crearPlan(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase, user } = await exigirRol(...ROLES);
  const semanaIn = String(form.get("semana") ?? "");
  const labor = idOpc(form.get("labor"));
  const personas = leerNumero(form.get("personas"));
  if (!esFecha(semanaIn)) return { error: "Indica la semana." };
  if (!labor) return { error: "Elige la labor." };
  if (personas !== null && (personas < 1 || personas > 500 || !Number.isInteger(personas))) return { error: "Las personas deben ser un número entero." };
  const semana = lunesDe(semanaIn);

  const { error } = await supabase.from("labor_plan").insert({
    semana, labor_tipo_id: labor, cuartel_id: idOpc(form.get("cuartel")), cuadrilla_id: idOpc(form.get("cuadrilla")), fiscalizador_id: idOpc(form.get("fiscalizador")),
    personas_previstas: personas, observacion: leerTexto(form.get("observacion")), creado_por: user.id,
  });
  if (error) return { error: "No se pudo guardar el plan." };
  revalidatePath("/labores", "layout");
  redirect(`/labores?semana=${semana}`);
}

export async function cambiarEstadoPlan(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const estado = String(form.get("estado") ?? "");
  const semana = String(form.get("semana") ?? "");
  if (id && ["pendiente", "hecha", "cancelada"].includes(estado)) await supabase.from("labor_plan").update({ estado }).eq("id", id);
  revalidatePath("/labores", "layout");
  redirect(`/labores${esFecha(semana) ? `?semana=${semana}` : ""}`);
}

export async function borrarPlan(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const semana = String(form.get("semana") ?? "");
  if (id) await supabase.from("labor_plan").delete().eq("id", id);
  revalidatePath("/labores", "layout");
  redirect(`/labores${esFecha(semana) ? `?semana=${semana}` : ""}`);
}

export async function registrarLabor(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase, user, perfil } = await exigirRol(...ROLES);
  const fecha = String(form.get("fecha") ?? "");
  const labor = idOpc(form.get("labor"));
  const personas = leerNumero(form.get("personas"));
  const dias = leerNumero(form.get("dias"));
  const modalidad = String(form.get("modalidad") ?? "dia");
  const monto = leerNumero(form.get("monto"));
  const planId = idOpc(form.get("plan"));

  if (!esFecha(fecha)) return { error: "Indica la fecha." };
  if (fecha > hoyChile()) return { error: "La fecha no puede ser futura." };
  if (!labor) return { error: "Elige la labor." };
  if (personas === null || !Number.isInteger(personas) || personas < 1 || personas > 500) return { error: "Indica cuántas personas trabajaron (número entero)." };
  if (dias === null || dias <= 0 || dias > 31) return { error: "Indica los días trabajados (por ejemplo 1, o 0,5 si fue medio día)." };
  if (!["dia", "trato"].includes(modalidad)) return { error: "Elige cómo se paga: por día o por trato." };
  if (monto !== null && (monto < 0 || monto > 1_000_000_000)) return { error: "Revisa el monto." };

  const jornadas = Math.round(personas * dias * 100) / 100;
  const { data: reg, error } = await supabase
    .from("labor_registro")
    .insert({
      fecha, cuartel_id: idOpc(form.get("cuartel")), labor_tipo_id: labor, cuadrilla_id: idOpc(form.get("cuadrilla")), fiscalizador_id: idOpc(form.get("fiscalizador")),
      personas, jornadas, modalidad, observacion: leerTexto(form.get("observacion")), plan_id: planId, creado_por: user.id,
    })
    .select("id")
    .single();
  if (error || !reg) return { error: "No se pudo guardar el registro." };

  if (monto !== null && puede(perfil.rol, "administrador", "enc_administrativo")) {
    const { error: e2 } = await supabase.from("labor_pago").insert({ registro_id: reg.id, monto: Math.round(monto) });
    if (e2) {
      await supabase.from("labor_registro").delete().eq("id", reg.id);
      return { error: "No se pudo guardar el monto. No se guardó nada." };
    }
  }
  if (planId) await supabase.from("labor_plan").update({ estado: "hecha" }).eq("id", planId);

  revalidatePath("/labores", "layout");
  redirect(`/labores?semana=${lunesDe(fecha)}`);
}

export async function borrarRegistro(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const semana = String(form.get("semana") ?? "");
  if (id) await supabase.from("labor_registro").delete().eq("id", id);
  revalidatePath("/labores", "layout");
  redirect(`/labores${esFecha(semana) ? `?semana=${semana}` : ""}`);
}

export async function crearCuadrilla(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol(...ROLES);
  const nombre = leerTexto(form.get("nombre"));
  const tipo = String(form.get("tipo") ?? "contratista");
  if (!nombre) return { error: "Escribe el nombre de la cuadrilla." };
  if (!["propia", "contratista"].includes(tipo)) return { error: "Tipo no válido." };
  const { error } = await supabase.from("cuadrilla").insert({ nombre, jefe: leerTexto(form.get("jefe")), tipo, telefono: leerTexto(form.get("telefono")) });
  if (error) return { error: error.code === "23505" ? "Ya existe una cuadrilla con ese nombre." : "No se pudo guardar." };
  revalidatePath("/labores", "layout");
  return { ok: "Cuadrilla agregada." };
}

export async function crearLabor(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol(...ROLES);
  const nombre = leerTexto(form.get("nombre"));
  if (!nombre) return { error: "Escribe el nombre de la labor." };
  const { error } = await supabase.from("labor_tipo").insert({ nombre });
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
