"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol, puede } from "@/lib/auth";
import { leerNumero, leerTexto } from "@/lib/formato";
import { esFecha, hoyChile, lunesDe, sumaDias } from "@/lib/semana";
import type { EstadoFormulario } from "@/components/Aviso";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOpc = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return UUID.test(s) ? s : null;
};
const ROLES = ["administrador", "enc_administrativo", "enc_agricola"] as const;

/** "8", "8 personas", "8,0" → 8 */
const entero = (v: FormDataEntryValue | null) => {
  const m = String(v ?? "").match(/\d+([.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : null;
};
/** Campo "cuartel" del formulario: un cuartel, "v:<variedad>" para la variedad completa, o vacío (general) */
const lugar = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  if (s.startsWith("v:")) return { cuartel_id: null, variedad_id: idOpc(s.slice(2)) };
  return { cuartel_id: idOpc(s), variedad_id: null };
};
/** Montos en pesos: "$480.000" → 480000 */
const pesos = (v: FormDataEntryValue | null) => {
  const d = String(v ?? "").replace(/[^\d]/g, "");
  return d === "" ? null : Number(d);
};

export async function crearPlan(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase, user } = await exigirRol(...ROLES);
  const id = idOpc(form.get("id"));
  const semanaIn = String(form.get("semana") ?? "");
  const labor = idOpc(form.get("labor"));
  const personasTxt = String(form.get("personas") ?? "").trim();
  const personas = personasTxt === "" ? null : entero(personasTxt);
  if (!esFecha(semanaIn)) return { error: "Falta indicar la semana." };
  if (!labor) return { error: "Falta elegir la labor." };
  if (personas !== null && (personas < 1 || personas > 500 || !Number.isInteger(personas))) return { error: "Las personas deben ser un número entero (por ejemplo 8)." };
  const semana = lunesDe(semanaIn);
  const datos = {
    semana, labor_tipo_id: labor, ...lugar(form.get("cuartel")), cuadrilla_id: idOpc(form.get("cuadrilla")), fiscalizador_id: idOpc(form.get("fiscalizador")),
    personas_previstas: personas, observacion: leerTexto(form.get("observacion")),
  };
  const { error } = id
    ? await supabase.from("labor_plan").update(datos).eq("id", id)
    : await supabase.from("labor_plan").insert({ ...datos, creado_por: user.id });
  if (error) {
    console.error("crearPlan", error);
    return { error: `No se pudo guardar el plan (${error.message}).` };
  }
  revalidatePath("/labores", "layout");
  redirect(`/labores?semana=${semana}${id ? "&ok=plan_editado" : ""}`);
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

export type EstadoRegistro = { error?: string; ok?: string; valores?: Record<string, string> } | null;


export async function registrarLabor(_: EstadoRegistro, form: FormData): Promise<EstadoRegistro> {
  const valores = Object.fromEntries([...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const fallo = (error: string): EstadoRegistro => ({ error, valores });
  let destino: string;
  try {
    const { supabase, user, perfil } = await exigirRol(...ROLES);
    const fecha = String(form.get("fecha") ?? "").trim();
    const labor = idOpc(form.get("labor"));
    const personas = entero(form.get("personas"));
    const diasTxt = String(form.get("dias") ?? "").trim();
    const dias = diasTxt === "" ? 1 : leerNumero(diasTxt);
    const modalidad = String(form.get("modalidad") ?? "dia");
    const monto = pesos(form.get("monto"));
    const planId = idOpc(form.get("plan"));
    const id = idOpc(form.get("id"));

    if (!esFecha(fecha)) return fallo("Falta la fecha del trabajo.");
    // Se permiten fechas futuras (trabajos ya acordados con contratistas), hasta un año
    if (fecha > sumaDias(hoyChile(), 366)) return fallo("Revisa la fecha: está a más de un año.");
    if (!labor) return fallo("Falta elegir la labor (por ejemplo Poda o Raleo).");
    if (personas === null || !Number.isInteger(personas) || personas < 1 || personas > 500) return fallo("Falta indicar cuántas personas trabajaron (un número, por ejemplo 8).");
    if (dias === null || dias <= 0 || dias > 31) return fallo("Revisa los días trabajados: 1 si fue un día completo, 0,5 si fue medio día.");
    if (!["dia", "trato"].includes(modalidad)) return fallo("Elige cómo se paga: por día o por trato.");
    if (monto !== null && (monto < 0 || monto > 1_000_000_000)) return fallo("Revisa el monto pagado.");

    const jornadas = Math.round(personas * dias * 100) / 100;
    const datos = {
      fecha, ...lugar(form.get("cuartel")), labor_tipo_id: labor, cuadrilla_id: idOpc(form.get("cuadrilla")), fiscalizador_id: idOpc(form.get("fiscalizador")),
      personas, jornadas, modalidad, observacion: leerTexto(form.get("observacion")),
    };
    const { data: reg, error } = id
      ? await supabase.from("labor_registro").update(datos).eq("id", id).select("id").single()
      : await supabase.from("labor_registro").insert({ ...datos, plan_id: planId, creado_por: user.id }).select("id").single();
    if (error || !reg) {
      console.error("registrarLabor", error);
      return fallo(`No se pudo guardar el registro${error?.message ? ` (${error.message})` : ""}. Intenta de nuevo; si sigue, avísame con este mensaje.`);
    }

    // Monto (solo quien ve finanzas): al editar, dejarlo vacío lo quita
    if (puede(perfil.rol, "administrador", "enc_administrativo") && form.has("monto")) {
      if (monto !== null) {
        const { error: e2 } = await supabase.from("labor_pago").upsert({ registro_id: reg.id, monto: Math.round(monto) }, { onConflict: "registro_id" });
        if (e2) {
          console.error("registrarLabor pago", e2);
          if (!id) await supabase.from("labor_registro").delete().eq("id", reg.id);
          return fallo(id ? "Se guardaron los cambios del trabajo, pero no el monto. Intenta de nuevo." : "No se pudo guardar el monto, así que no se guardó nada. Intenta de nuevo.");
        }
      } else if (id) {
        await supabase.from("labor_pago").delete().eq("registro_id", reg.id);
      }
    }
    if (planId && !id) await supabase.from("labor_plan").update({ estado: "hecha" }).eq("id", planId);

    revalidatePath("/labores", "layout");
    revalidatePath("/");
    destino = `/labores?semana=${lunesDe(fecha)}&ok=${id ? "editado" : "registro"}`;
  } catch (e) {
    // exigirRol puede redirigir (sesión vencida): esa señal se deja pasar
    if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    console.error("registrarLabor excepción", e);
    return fallo("Algo falló al guardar. Revisa tu conexión e intenta de nuevo.");
  }
  redirect(destino);
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
