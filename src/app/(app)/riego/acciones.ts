"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { leerNumero, leerTexto } from "@/lib/formato";
import type { EstadoFormulario } from "@/components/Aviso";

export async function editarEquipo(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const id = String(form.get("id"));

  const { error } = await supabase
    .from("equipo_riego")
    .update({
      nombre: leerTexto(form.get("nombre")) ?? "Equipo",
      origen: leerTexto(form.get("origen")),
      emisor: leerTexto(form.get("emisor")),
      filtro: leerTexto(form.get("filtro")),
      bomba: leerTexto(form.get("bomba")),
      observaciones: leerTexto(form.get("observaciones")),
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar el equipo." };

  for (const sectorId of form.getAll("sector_id").map(String)) {
    const sup = leerNumero(form.get(`superficie_${sectorId}`));
    if (sup !== null && sup <= 0) return { error: "La superficie de cada sector debe ser mayor que cero." };
    const { error: e } = await supabase
      .from("sector_riego")
      .update({
        superficie_ha: sup,
        lineas_por_hilera: leerNumero(form.get(`lineas_${sectorId}`)),
        caudal_emisor_lh: leerNumero(form.get(`caudal_${sectorId}`)),
        distancia_emisores_m: leerNumero(form.get(`distancia_${sectorId}`)),
        precipitacion_mmh: leerNumero(form.get(`precipitacion_${sectorId}`)),
        horas_turno: leerNumero(form.get(`horas_${sectorId}`)),
        observaciones: leerTexto(form.get(`obs_${sectorId}`)),
      })
      .eq("id", sectorId);
    if (e) return { error: "Se guardó el equipo, pero no todos los sectores." };
  }

  revalidatePath("/riego");
  redirect("/riego?ok=1");
}
