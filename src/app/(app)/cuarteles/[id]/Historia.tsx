// Lo que ha pasado en el cuartel esta temporada: aplicaciones, labores, cosecha y costo aproximado por hectárea.
import Link from "next/link";
import { clp, fecha, num } from "@/lib/formato";
import { hoyChile } from "@/lib/semana";
import { leerTodo } from "@/lib/programas";
import { Icono } from "@/components/Icono";

type Evento = { fecha: string; tipo: "aplicacion" | "labor" | "cosecha"; titulo: string; detalle: string };

const TIPO = {
  aplicacion: { icono: "programas", color: "bg-verde-claro text-verde", nombre: "Aplicación" },
  labor: { icono: "labores", color: "bg-ambar-claro text-ambar", nombre: "Labor" },
  cosecha: { icono: "cosecha", color: "bg-alerta-claro text-alerta", nombre: "Cosecha" },
} as const;

export async function HistoriaTemporada({ supabase, rol, cuartelId, variedadId, superficie }: { supabase: any; rol: string; cuartelId: string; variedadId: string | null; superficie: number }) {
  const hoy = hoyChile();
  const veMontos = ["administrador", "enc_administrativo", "propietario"].includes(rol);
  const { data: temporada } = await supabase.from("temporada").select("id, nombre, inicio, termino").lte("inicio", hoy).gte("termino", hoy).maybeSingle();
  if (!temporada) return null;
  const { inicio, termino } = temporada;

  const [{ data: apps }, { data: labores }, { data: tipos }, { data: cosechas }] = await Promise.all([
    variedadId
      ? supabase.from("aplicacion_realizada").select("id, fecha, titulo, litros_ha, observacion").eq("variedad_id", variedadId).gte("fecha", inicio).lte("fecha", termino).order("fecha", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("labor_registro").select("id, fecha, labor_tipo_id, personas, jornadas, observacion, variedad_id").or(variedadId ? `cuartel_id.eq.${cuartelId},variedad_id.eq.${variedadId}` : `cuartel_id.eq.${cuartelId}`).eq("estado", "realizado").gte("fecha", inicio).lte("fecha", termino).order("fecha", { ascending: false }),
    supabase.from("labor_tipo").select("id, nombre"),
    supabase.from("cosecha").select("id, fecha, kilos, cantidad, unidad, destino").eq("cuartel_id", cuartelId).gte("fecha", inicio).lte("fecha", termino).order("fecha", { ascending: false }),
  ]);

  const nombreLabor = new Map<string, string>(((tipos ?? []) as any[]).map((t) => [t.id as string, t.nombre as string] as [string, string]));
  const listaLabores = (labores ?? []) as any[];
  const { data: pagos } = veMontos && listaLabores.length ? await supabase.from("labor_pago").select("registro_id, monto").in("registro_id", listaLabores.map((l) => l.id)) : { data: [] };
  const pagoDe = new Map<string, number>();
  for (const p of (pagos ?? []) as any[]) pagoDe.set(p.registro_id, (pagoDe.get(p.registro_id) ?? 0) + Number(p.monto ?? 0));

  // Costo aproximado por hectárea: gasto directo de su variedad + gastos generales repartidos por hectárea del predio
  let costo: { directoHa: number; generalHa: number } | null = null;
  if (veMontos && variedadId) {
    const [{ data: cecos }, { data: cuartelesVar }, { data: campo }] = await Promise.all([
      supabase.from("ceco").select("id, tipo, variedad_id"),
      supabase.from("v_cuartel").select("superficie_ha, estado_productivo").eq("variedad_id", variedadId).eq("activo", true),
      supabase.from("campo").select("superficie_total_ha").maybeSingle(),
    ]);
    const deVariedad = new Set(((cecos ?? []) as any[]).filter((c) => c.variedad_id === variedadId).map((c) => c.id as string));
    const generales = new Set(((cecos ?? []) as any[]).filter((c) => c.tipo === "general").map((c) => c.id as string));
    const gastos = await leerTodo<any>((d, h) => supabase.from("gasto").select("ceco_id, total").eq("temporada_id", temporada.id).range(d, h));
    const haVar = ((cuartelesVar ?? []) as any[]).filter((c) => c.estado_productivo !== "sin_plantar" && c.estado_productivo !== "eliminado").reduce((s, c) => s + Number(c.superficie_ha ?? 0), 0);
    const haPredio = Number(campo?.superficie_total_ha ?? 0);
    const directo = gastos.filter((g) => deVariedad.has(g.ceco_id)).reduce((s, g) => s + Number(g.total ?? 0), 0);
    const general = gastos.filter((g) => generales.has(g.ceco_id)).reduce((s, g) => s + Number(g.total ?? 0), 0);
    if (haVar > 0 && (directo > 0 || general > 0)) costo = { directoHa: directo / haVar, generalHa: haPredio > 0 ? general / haPredio : 0 };
  }

  const kilos = ((cosechas ?? []) as any[]).reduce((s, c) => s + Number(c.kilos ?? 0), 0);
  const jornadas = listaLabores.reduce((s, l) => s + Number(l.jornadas ?? 0), 0);
  const montoLabores = [...pagoDe.values()].reduce((s, v) => s + v, 0);

  const eventos: Evento[] = [
    ...((apps ?? []) as any[]).map((a) => ({ fecha: a.fecha, tipo: "aplicacion" as const, titulo: a.titulo || "Aplicación", detalle: [a.litros_ha ? `${num(Number(a.litros_ha))} L/ha` : null, "en toda la variedad", a.observacion].filter(Boolean).join(" · ") })),
    ...listaLabores.map((l) => ({
      fecha: l.fecha,
      tipo: "labor" as const,
      titulo: nombreLabor.get(l.labor_tipo_id) ?? "Labor",
      detalle: [l.variedad_id ? "en toda la variedad" : null, l.personas ? `${num(l.personas)} personas` : null, l.jornadas ? `${num(Number(l.jornadas), 1)} jornadas` : null, pagoDe.get(l.id) ? clp(pagoDe.get(l.id)!) : null, l.observacion].filter(Boolean).join(" · "),
    })),
    ...((cosechas ?? []) as any[]).map((c) => ({
      fecha: c.fecha,
      tipo: "cosecha" as const,
      titulo: "Cosecha",
      detalle: [c.kilos != null ? `${num(Number(c.kilos))} kg` : null, c.cantidad != null ? `${num(Number(c.cantidad))} ${c.unidad}` : null].filter(Boolean).join(" · "),
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const costoHa = costo ? costo.directoHa + costo.generalHa : null;

  return (
    <section className="tarjeta mt-5 overflow-hidden">
      <div className="p-5 pb-3">
        <h2 className="font-semibold">Esta temporada ({temporada.nombre})</h2>
        <p className="text-sm text-tinta-suave">Lo que se ha hecho en este cuartel, del más reciente al más antiguo.</p>
      </div>
      <dl className="grid grid-cols-2 gap-px border-y border-linea bg-linea sm:grid-cols-4">
        <div className="bg-white p-4"><dt className="text-xs text-tinta-suave">Aplicaciones</dt><dd className="text-xl font-semibold tabular-nums">{(apps ?? []).length}</dd></div>
        <div className="bg-white p-4"><dt className="text-xs text-tinta-suave">Labores</dt><dd className="text-xl font-semibold tabular-nums">{listaLabores.length}</dd>{jornadas > 0 && <dd className="text-xs text-tinta-suave">{num(jornadas, 1)} jornadas{montoLabores > 0 ? ` · ${clp(montoLabores)}` : ""}</dd>}</div>
        <div className="bg-white p-4"><dt className="text-xs text-tinta-suave">Cosechado</dt><dd className="text-xl font-semibold tabular-nums">{kilos > 0 ? `${num(kilos)} kg` : "—"}</dd>{kilos > 0 && superficie > 0 && <dd className="text-xs text-tinta-suave">{num(kilos / superficie)} kg/ha</dd>}</div>
        <div className="bg-white p-4">
          <dt className="text-xs text-tinta-suave">{veMontos ? "Gasto aprox. por ha" : "Superficie"}</dt>
          <dd className="text-xl font-semibold tabular-nums">{veMontos ? (costoHa ? clp(Math.round(costoHa)) : "—") : `${num(superficie, 2)} ha`}</dd>
          {costo && <dd className="text-xs text-tinta-suave">{clp(Math.round(costo.directoHa))} de la variedad + {clp(Math.round(costo.generalHa))} generales</dd>}
        </div>
      </dl>
      {eventos.length === 0 ? (
        <p className="p-5 text-sm text-tinta-suave">
          Todavía no hay aplicaciones, labores ni cosecha registradas esta temporada.{" "}
          <Link href="/labores/registrar" className="font-medium text-verde underline">Registrar una labor</Link>
        </p>
      ) : (
        <ol className="relative px-5 py-4">
          <span className="absolute bottom-6 left-[2.25rem] top-6 w-px bg-linea" aria-hidden="true" />
          {eventos.slice(0, 40).map((e, i) => (
            <li key={i} className="relative flex gap-3 py-2">
              <span className={`z-[1] grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-white ${TIPO[e.tipo].color}`}><Icono nombre={TIPO[e.tipo].icono} className="size-4" /></span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-sm"><span className="font-medium">{e.titulo}</span> <span className="text-tinta-suave">· {fecha(e.fecha)}</span></p>
                {e.detalle && <p className="text-xs text-tinta-suave">{e.detalle}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {veMontos && costo && (
        <p className="border-t border-linea px-5 py-2.5 text-xs text-tinta-suave">
          El gasto por ha sale de Finanzas: lo cargado a la variedad dividido por sus hectáreas, más los gastos generales del campo repartidos por las hectáreas del predio. Es aproximado hasta que cada labor y producto quede anotado por cuartel.
        </p>
      )}
    </section>
  );
}
