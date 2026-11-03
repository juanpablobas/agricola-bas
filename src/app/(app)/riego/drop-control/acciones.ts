"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dice a qué sector de la app corresponde cada zona de Drop Control */
export async function vincularZona(form: FormData) {
  const { supabase, user } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const zona = String(form.get("zona") ?? "").slice(0, 64);
  const nombre = String(form.get("nombre") ?? "").slice(0, 120);
  const sector = String(form.get("sector") ?? "");
  if (!zona || (sector && !UUID.test(sector))) redirect("/riego/drop-control?error=1");
  const { error } = sector
    ? await supabase.from("dropcontrol_zona").upsert({ zona_id: zona, zona_nombre: nombre, sector_id: sector, actualizado_por: user.id, actualizado_en: new Date().toISOString() }, { onConflict: "zona_id" })
    : await supabase.from("dropcontrol_zona").delete().eq("zona_id", zona);
  if (error) redirect("/riego/drop-control?error=1");
  revalidatePath("/riego/drop-control");
  redirect("/riego/drop-control?ok=1");
}
