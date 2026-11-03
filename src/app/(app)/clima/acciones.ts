"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { leerNumero } from "@/lib/formato";

export async function guardarUbicacion(form: FormData) {
  await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const lat = leerNumero(form.get("lat"));
  const lng = leerNumero(form.get("lng"));
  // Rango razonable para Chile continental
  if (lat === null || lng === null || lat < -56 || lat > -17 || lng < -76 || lng > -66) redirect("/clima?error=ubicacion");
  const admin = crearClienteAdmin();
  const { data: campo } = await admin.from("campo").select("id").limit(1).maybeSingle();
  if (!campo) redirect("/clima?error=ubicacion");
  const { error } = await admin.from("campo").update({ latitud: Math.round(lat * 1e6) / 1e6, longitud: Math.round(lng * 1e6) / 1e6 }).eq("id", campo.id);
  if (error) redirect("/clima?error=ubicacion");
  revalidatePath("/clima");
  revalidatePath("/");
  redirect("/clima?ok=1");
}
