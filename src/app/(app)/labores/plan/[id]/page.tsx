import { notFound } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { FormPlan } from "../../FormPlan";
import { cargarOpciones } from "../../lib";

export const metadata = { title: "Editar tarea del plan" };

export default async function EditarPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: x } = await supabase.from("labor_plan").select("id, semana, cuartel_id, labor_tipo_id, cuadrilla_id, fiscalizador_id, personas_previstas, observacion").eq("id", id).maybeSingle();
  if (!x) notFound();
  const op = await cargarOpciones(supabase, { cuadrilla: x.cuadrilla_id, labor: x.labor_tipo_id, fiscalizador: x.fiscalizador_id });
  const valores: Record<string, string> = {
    semana: x.semana, labor: x.labor_tipo_id, cuartel: x.cuartel_id ?? "", cuadrilla: x.cuadrilla_id ?? "", fiscalizador: x.fiscalizador_id ?? "",
    personas: x.personas_previstas ? String(x.personas_previstas) : "", observacion: x.observacion ?? "",
  };
  return (
    <>
      <Encabezado titulo="Editar tarea del plan" subtitulo="Cambia la labor, el cuartel, la cuadrilla, la semana o las instrucciones." volver={{ href: `/labores?semana=${x.semana}`, texto: "Labores" }} />
      <section className="tarjeta max-w-2xl p-5">
        <FormPlan semana={x.semana} cuarteles={op.cuarteles} labores={op.labores} cuadrillas={op.cuadrillas} trabajadores={op.trabajadores} editar={{ id: x.id, valores }} />
      </section>
    </>
  );
}
