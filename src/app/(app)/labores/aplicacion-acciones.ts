"use server";
// Marca como realizada una aplicación del programa (para una o varias variedades), descontando o no los productos de bodega.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { leerTexto } from "@/lib/formato";
import { esFecha, hoyChile } from "@/lib/semana";
import { calcularAplicacion } from "./aplicacion";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type EstadoAplicacion = { error?: string } | null;

export async function marcarAplicacionRealizada(_: EstadoAplicacion, form: FormData): Promise<EstadoAplicacion> {
  const { supabase, user } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const appId = String(form.get("app") ?? "");
  const fecha = String(form.get("fecha") ?? "");
  const descontar = form.get("descontar") === "si";
  const elegidas = form.getAll("variedad").map(String).filter((x) => UUID.test(x));
  const conProducto = new Set(form.getAll("producto").map(String));
  const obs = leerTexto(form.get("obs"));
  if (!UUID.test(appId)) return { error: "Aplicación no válida." };
  if (!esFecha(fecha) || fecha > hoyChile()) return { error: "Revisa la fecha: no puede ser un día que todavía no llega." };
  if (elegidas.length === 0) return { error: "Marca al menos una variedad." };

  const c = await calcularAplicacion(supabase, appId);
  if (!c) return { error: "No se encontró la aplicación." };
  const variedades = c.variedades.filter((v) => elegidas.includes(v.id));
  if (variedades.length === 0) return { error: "Esas variedades ya están registradas." };
  const titulo = `${c.programa} · ${c.titulo}`;

  if (descontar) {
    const usar = c.productos.filter((p) => conProducto.has(p.linea_id) && p.producto_id);
    // Revisa el stock de todo junto antes de registrar nada
    const falta: string[] = [];
    const totalPor = new Map<string, { nombre: string; cant: number; stock: number }>();
    for (const p of usar) {
      const t = variedades.reduce((s, v) => s + (p.porVariedad.get(v.id) ?? 0), 0);
      const prev = totalPor.get(p.producto_id!);
      totalPor.set(p.producto_id!, { nombre: p.enBodega ?? p.nombre, cant: (prev?.cant ?? 0) + t, stock: p.stock ?? 0 });
    }
    for (const x of totalPor.values()) if (x.cant > x.stock + 0.0005) falta.push(`${x.nombre} (hay ${x.stock.toLocaleString("es-CL")}, se necesitan ${(Math.round(x.cant * 100) / 100).toLocaleString("es-CL")})`);
    if (falta.length) return { error: `No alcanza el stock de: ${falta.join("; ")}. Desmarca ese producto o registra sin descontar.` };

    for (const v of variedades) {
      const lineas = usar.map((p) => ({ producto_id: p.producto_id!, cantidad: p.porVariedad.get(v.id) ?? 0 })).filter((x) => x.cantidad > 0);
      if (lineas.length === 0) {
        const { error } = await supabase.from("aplicacion_realizada").insert({ fecha, variedad_id: v.id, programa_aplicacion_id: appId, titulo, litros_ha: v.litros, ha: v.ha, observacion: obs, creado_por: user.id });
        if (error) return { error: `No se pudo registrar ${v.nombre}.` };
        continue;
      }
      const { error } = await supabase.rpc("registrar_aplicacion", {
        p_fecha: fecha, p_variedad: v.id, p_prog_app: appId, p_titulo: titulo, p_litros: v.litros, p_ha: v.ha, p_obs: obs, p_lineas: lineas,
      });
      if (error) {
        const msg = error.message ?? "";
        return { error: `${v.nombre}: ${msg.startsWith("No alcanza") || msg.startsWith("Esa variedad") ? msg : "no se pudo registrar."}${variedades.indexOf(v) > 0 ? " Las variedades anteriores sí quedaron registradas." : ""}` };
      }
    }
  } else {
    const { error } = await supabase.from("aplicacion_realizada").insert(
      variedades.map((v) => ({ fecha, variedad_id: v.id, programa_aplicacion_id: appId, titulo, litros_ha: v.litros, ha: v.ha, observacion: [obs, "Sin descontar de bodega"].filter(Boolean).join(" · "), creado_por: user.id })),
    );
    if (error) return { error: "No se pudo registrar la aplicación." };
  }

  // Si estaba postergada, deja de estarlo para esas variedades
  await supabase.from("aplicacion_estado").delete().eq("programa_aplicacion_id", appId).in("variedad_id", variedades.map((v) => v.id));
  revalidatePath("/programas", "layout");
  revalidatePath("/inventario", "layout");
  revalidatePath("/labores", "layout");
  revalidatePath("/");
  const volver = form.get("volver") === "/programas" ? "/programas" : "/labores";
  redirect(`${volver}?ok=${descontar ? "aplicacion_descontada" : "aplicacion"}`);
}
