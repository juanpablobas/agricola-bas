import { notFound } from "next/navigation";
import { exigirRol, puede } from "@/lib/auth";
import { hoyChile } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { FormRegistro } from "../../FormRegistro";
import { cargarOpciones } from "../../lib";

export const metadata = { title: "Editar labor" };

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const dec = (v: unknown) => (v === null || v === undefined ? "" : String(Number(v)).replace(".", ","));

export default async function EditarLabor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ hecho?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: r }, { data: trab }] = await Promise.all([
    supabase.from("labor_registro").select("*").eq("id", id).maybeSingle(),
    supabase.from("labor_trabajador").select("trabajador_id").eq("labor_id", id),
  ]);
  if (!r) notFound();
  const conMonto = puede(perfil.rol, "administrador", "enc_administrativo");
  const op = await cargarOpciones(supabase, { cuadrilla: r.cuadrilla_id, labor: r.labor_tipo_id, fiscalizador: r.fiscalizador_id });
  const hoy = hoyChile();
  const dias = r.personas && r.jornadas && !r.horas ? Math.round((Number(r.jornadas) / Number(r.personas)) * 100) / 100 : 1;
  const confirmar = !!q.hecho && r.estado !== "realizado";
  const valores: Record<string, string> = {
    estado: r.estado, fecha: confirmar && r.fecha > hoy ? hoy : r.fecha, fecha_original: txt(r.fecha_original),
    fecha_inicio: txt(r.fecha_inicio), fecha_termino: txt(r.fecha_termino),
    labor: r.labor_tipo_id, cuartel: r.cuartel_id ?? (r.variedad_id ? `v:${r.variedad_id}` : ""),
    cuadrilla: txt(r.cuadrilla_id), fiscalizador: txt(r.fiscalizador_id), ejecucion: r.ejecucion ?? "propio",
    trabajadores: ((trab ?? []) as any[]).map((t) => t.trabajador_id).join(","),
    personas: txt(r.personas), dias: dec(dias), horas: dec(r.horas),
    cantidad_plan: dec(r.cantidad_plan), cantidad_ejecutada: dec(r.cantidad_ejecutada ?? (confirmar ? r.cantidad_plan : null)), unidad_cantidad: r.unidad_cantidad ?? "ha",
    cobro: r.cobro ?? "ha", observacion: txt(r.observacion), documento: txt(r.documento),
    ...(conMonto ? {
      valor_jornal: txt(r.valor_jornal), valor_hora: txt(r.valor_hora), precio_unitario: txt(r.precio_unitario != null ? Math.round(Number(r.precio_unitario)) : null),
      estado_pago: r.estado_pago ?? "pendiente", monto_pagado: txt(r.monto_pagado), costo_maquinaria: txt(r.costo_maquinaria), costo_insumos: txt(r.costo_insumos), presupuesto: txt(r.presupuesto),
    } : {}),
  };
  return (
    <>
      <Encabezado
        titulo={confirmar ? "Confirmar que se hizo" : "Editar labor"}
        subtitulo={confirmar ? "Revisa las fechas, quién la hizo y cuánto se ejecutó, y guarda." : "Corrige lo que haga falta. Los cambios quedan en el historial."}
        volver={{ href: `/labores/${id}`, texto: "Volver a la labor" }}
      />
      <section className="tarjeta max-w-3xl p-4 sm:p-5">
        <FormRegistro
          hoy={hoy} cuarteles={op.cuarteles} variedades={op.variedades} labores={op.labores} cuadrillas={op.cuadrillas} trabajadores={op.trabajadores}
          conMonto={conMonto} inicial={{}} editar={{ id: r.id, valores }} confirmar={confirmar}
        />
      </section>
    </>
  );
}
