import { notFound } from "next/navigation";
import { exigirRol, puede } from "@/lib/auth";
import { hoyChile, lunesDe } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { FormRegistro } from "../../FormRegistro";
import { cargarOpciones } from "../../lib";

export const metadata = { title: "Editar trabajo" };

export default async function EditarRegistro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: r } = await supabase.from("labor_registro").select("id, fecha, cuartel_id, labor_tipo_id, cuadrilla_id, fiscalizador_id, personas, jornadas, modalidad, observacion").eq("id", id).maybeSingle();
  if (!r) notFound();
  const conMonto = puede(perfil.rol, "administrador", "enc_administrativo");
  const { data: pago } = conMonto ? await supabase.from("labor_pago").select("monto").eq("registro_id", id).maybeSingle() : { data: null };
  const op = await cargarOpciones(supabase, { cuadrilla: r.cuadrilla_id, labor: r.labor_tipo_id, fiscalizador: r.fiscalizador_id });
  const dias = Math.round((Number(r.jornadas) / Number(r.personas)) * 100) / 100;
  const valores: Record<string, string> = {
    fecha: r.fecha, labor: r.labor_tipo_id, cuartel: r.cuartel_id ?? "", cuadrilla: r.cuadrilla_id ?? "", fiscalizador: r.fiscalizador_id ?? "",
    personas: String(r.personas), dias: String(dias).replace(".", ","), modalidad: r.modalidad, observacion: r.observacion ?? "",
    monto: pago?.monto != null ? String(Math.round(Number(pago.monto))) : "",
  };
  return (
    <>
      <Encabezado titulo="Editar trabajo" subtitulo="Corrige lo que haga falta y guarda los cambios." volver={{ href: `/labores?semana=${lunesDe(r.fecha)}`, texto: "Labores" }} />
      <section className="tarjeta max-w-2xl p-5">
        <FormRegistro hoy={hoyChile()} cuarteles={op.cuarteles} labores={op.labores} cuadrillas={op.cuadrillas} trabajadores={op.trabajadores} conMonto={conMonto} inicial={{}} editar={{ id: r.id, valores }} />
      </section>
    </>
  );
}
