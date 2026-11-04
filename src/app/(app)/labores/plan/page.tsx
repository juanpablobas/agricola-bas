import { exigirRol } from "@/lib/auth";
import { esFecha, hoyChile, lunesDe } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { FormPlan } from "../FormPlan";
import { cargarOpciones } from "../lib";

export const metadata = { title: "Planificar semana" };

export default async function Planificar({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const p = await searchParams;
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const op = await cargarOpciones(supabase);
  const semana = esFecha(p.semana) ? lunesDe(p.semana) : lunesDe(hoyChile());
  return (
    <>
      <Encabezado titulo="Planificar semana" subtitulo="Anota lo que se va a hacer, en lugar del cuaderno. Después lo registras con un toque." volver={{ href: `/labores?semana=${semana}`, texto: "Labores" }} />
      <section className="tarjeta max-w-2xl p-5">
        {op.cuadrillas.length === 0 && <div className="mb-4"><Aviso>Todavía no hay cuadrillas. Puedes planificar igual y elegir la cuadrilla después, o crearlas en “Cuadrillas, trabajadores y labores”.</Aviso></div>}
        <FormPlan semana={semana} cuarteles={op.cuarteles} variedades={op.variedades} labores={op.labores} cuadrillas={op.cuadrillas} trabajadores={op.trabajadores} />
      </section>
    </>
  );
}
