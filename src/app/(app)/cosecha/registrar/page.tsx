import { exigirRol } from "@/lib/auth";
import { hoyChile } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { cargarOpciones } from "../../labores/lib";
import { FormCosecha } from "./FormCosecha";

export const metadata = { title: "Registrar cosecha" };

export default async function RegistrarCosecha() {
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const op = await cargarOpciones(supabase);
  return (
    <>
      <Encabezado titulo="Registrar cosecha" subtitulo="Lo que se cosechó en un cuartel en un día." volver={{ href: "/cosecha", texto: "Cosecha" }} />
      <section className="tarjeta max-w-2xl p-5">
        <FormCosecha hoy={hoyChile()} cuarteles={op.cuarteles} cuadrillas={op.cuadrillas} />
      </section>
    </>
  );
}
