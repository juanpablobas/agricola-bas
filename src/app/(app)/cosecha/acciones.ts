"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { leerNumero, leerTexto } from "@/lib/formato";
import { esFecha, hoyChile } from "@/lib/semana";
import type { EstadoFormulario } from "@/components/Aviso";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLES = ["administrador", "enc_administrativo", "enc_agricola"] as const;
const UNIDADES = ["bins", "cajas", "bandejas", "tarros", "baldes"];
const DESTINOS = ["exportadora", "mercado_nacional", "proceso", "otro"];

/** "Juan 25" / "Juan: 25" / "María Pérez - 18" → una persona y sus baldes por línea */
function leerBaldes(texto: string): { persona: string; baldes: number }[] | null {
  const out: { persona: string; baldes: number }[] = [];
  for (const linea of texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = /^(.+?)[\s:;,=-]+(\d{1,4})$/.exec(linea);
    if (!m) return null;
    out.push({ persona: m[1].trim().slice(0, 80), baldes: Number(m[2]) });
  }
  return out;
}

export async function registrarCosecha(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  const { supabase, user } = await exigirRol(...ROLES);
  const fecha = String(form.get("fecha") ?? "");
  const cuartel = String(form.get("cuartel") ?? "");
  const cuadrilla = String(form.get("cuadrilla") ?? "");
  const kilos = leerNumero(form.get("kilos"));
  const cantidad = leerNumero(form.get("cantidad"));
  const unidad = String(form.get("unidad") ?? "");
  const destino = String(form.get("destino") ?? "exportadora");
  const baldes = leerBaldes(String(form.get("baldes") ?? ""));

  if (!esFecha(fecha)) return { error: "Indica la fecha." };
  if (fecha > hoyChile()) return { error: "La fecha no puede ser futura." };
  if (!UUID.test(cuartel)) return { error: "Elige el cuartel." };
  if (cuadrilla && !UUID.test(cuadrilla)) return { error: "Revisa la cuadrilla." };
  if (!DESTINOS.includes(destino)) return { error: "Elige el destino." };
  if (kilos !== null && (kilos < 0 || kilos > 10_000_000)) return { error: "Revisa los kilos." };
  if (cantidad !== null && (cantidad < 0 || cantidad > 1_000_000)) return { error: "Revisa la cantidad." };
  if (cantidad !== null && !UNIDADES.includes(unidad)) return { error: "Indica en qué se cuenta (bins, cajas, bandejas…)." };
  if (baldes === null) return { error: "En los baldes escribe una persona por línea con su número, por ejemplo: Juan 25." };
  if (kilos === null && cantidad === null && baldes.length === 0) return { error: "Indica los kilos, la cantidad o los baldes cosechados." };

  const { data: fila, error } = await supabase.from("cosecha").insert({
    fecha, cuartel_id: cuartel, cuadrilla_id: cuadrilla || null, kilos, cantidad, unidad: cantidad !== null ? unidad : null, destino,
    observacion: leerTexto(form.get("obs")), creado_por: user.id,
  }).select("id").single();
  if (error || !fila) return { error: "No se pudo guardar la cosecha." };

  if (baldes.length) {
    const { error: e2 } = await supabase.from("cosecha_balde").insert(baldes.map((b) => ({ cosecha_id: fila.id, persona: b.persona, baldes: b.baldes })));
    if (e2) {
      await supabase.from("cosecha").delete().eq("id", fila.id);
      return { error: "No se pudieron guardar los baldes. No se guardó nada; intenta de nuevo." };
    }
  }
  revalidatePath("/cosecha", "layout");
  redirect("/cosecha?ok=1");
}

export async function borrarCosecha(form: FormData) {
  const { supabase } = await exigirRol(...ROLES);
  const id = String(form.get("id") ?? "");
  if (UUID.test(id)) await supabase.from("cosecha").delete().eq("id", id);
  revalidatePath("/cosecha", "layout");
  redirect("/cosecha?ok=borrada");
}
