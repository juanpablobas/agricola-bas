import { exigirRol, puede } from "@/lib/auth";
import { hoyChile, lunesDe } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { FormRegistro, type Inicial } from "../FormRegistro";
import { cargarOpciones } from "../lib";

export const metadata = { title: "Registrar trabajo" };

export default async function Registrar({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");

  let inicial: Inicial = {};
  if (p.plan && /^[0-9a-f-]{36}$/i.test(p.plan)) {
    const { data: pl } = await supabase.from("labor_plan").select("id, cuartel_id, labor_tipo_id, cuadrilla_id, personas_previstas").eq("id", p.plan).maybeSingle();
    if (pl) inicial = { plan: pl.id, cuartel: pl.cuartel_id ?? undefined, labor: pl.labor_tipo_id, cuadrilla: pl.cuadrilla_id ?? undefined, personas: pl.personas_previstas ?? undefined };
  }
  const op = await cargarOpciones(supabase, { cuadrilla: inicial.cuadrilla, labor: inicial.labor });
  const hoy = hoyChile();
  return (
    <>
      <Encabezado titulo="Registrar trabajo" subtitulo={inicial.plan ? "Viene de lo planificado: confirma las personas y los días." : "Lo que hizo una cuadrilla en un día."} volver={{ href: `/labores?semana=${lunesDe(hoy)}`, texto: "Labores" }} />
      <section className="tarjeta max-w-2xl p-5">
        <FormRegistro hoy={hoy} cuarteles={op.cuarteles} labores={op.labores} cuadrillas={op.cuadrillas} conMonto={puede(perfil.rol, "administrador", "enc_administrativo")} inicial={inicial} />
      </section>
    </>
  );
}
