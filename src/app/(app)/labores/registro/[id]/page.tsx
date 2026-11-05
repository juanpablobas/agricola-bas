import { notFound } from "next/navigation";
import { exigirRol, puede } from "@/lib/auth";
import { hoyChile, lunesDe } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { FormRegistro } from "../../FormRegistro";
import { cargarOpciones } from "../../lib";

export const metadata = { title: "Editar trabajo" };

export default async function EditarRegistro({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ hecho?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: r } = await supabase.from("labor_registro").select("id, fecha, cuartel_id, variedad_id, labor_tipo_id, cuadrilla_id, fiscalizador_id, personas, jornadas, modalidad, observacion, estado").eq("id", id).maybeSingle();
  if (!r) notFound();
  const conMonto = puede(perfil.rol, "administrador", "enc_administrativo");
  const { data: pago } = conMonto ? await supabase.from("labor_pago").select("monto").eq("registro_id", id).maybeSingle() : { data: null };
  const op = await cargarOpciones(supabase, { cuadrilla: r.cuadrilla_id, labor: r.labor_tipo_id, fiscalizador: r.fiscalizador_id });
  const dias = r.personas && r.jornadas ? Math.round((Number(r.jornadas) / Number(r.personas)) * 100) / 100 : 1;
  const valores: Record<string, string> = {
    fecha: r.fecha, labor: r.labor_tipo_id, cuartel: r.cuartel_id ?? (r.variedad_id ? `v:${r.variedad_id}` : ""), cuadrilla: r.cuadrilla_id ?? "", fiscalizador: r.fiscalizador_id ?? "",
    personas: r.personas ? String(r.personas) : "", estado: r.estado, dias: String(dias).replace(".", ","), modalidad: r.modalidad, observacion: r.observacion ?? "",
    monto: pago?.monto != null ? String(Math.round(Number(pago.monto))) : "",
  };
  return (
    <>
      <Encabezado titulo={q.hecho ? "Confirmar que se hizo" : "Editar labor"} subtitulo={q.hecho ? "Revisa la fecha en que se hizo y cuántas personas trabajaron, y guarda." : "Corrige lo que haga falta y guarda los cambios."} volver={{ href: `/labores?semana=${lunesDe(r.fecha)}`, texto: "Labores" }} />
      <section className="tarjeta max-w-2xl p-5">
        <FormRegistro hoy={hoyChile()} cuarteles={op.cuarteles} variedades={op.variedades} labores={op.labores} cuadrillas={op.cuadrillas} trabajadores={op.trabajadores} conMonto={conMonto} inicial={{}} editar={{ id: r.id, valores: q.hecho && valores.fecha > hoyChile() ? { ...valores, fecha: hoyChile() } : valores }} estadoInicial={q.hecho ? "realizado" : undefined} />
      </section>
    </>
  );
}
