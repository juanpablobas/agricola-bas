import { exigirRol } from "@/lib/auth";
import { cargarEspecies, cargarSectores } from "@/lib/catalogos";
import { Encabezado } from "@/components/Encabezado";
import { FormularioCuartel } from "../../FormularioCuartel";
import { cargarCuartel } from "../cargar";

export const metadata = { title: "Editar cuartel" };

export default async function EditarCuartel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const [c, especies, sectores] = await Promise.all([cargarCuartel(supabase, id), cargarEspecies(supabase), cargarSectores(supabase)]);
  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado
        titulo={`Editar cuartel ${c.codigo}`}
        subtitulo="Corrige los datos actuales. Si se reinjertó o replantó, usa “Cambio de plantación” para conservar la historia."
        volver={{ href: `/cuarteles/${id}`, texto: `Cuartel ${c.codigo}` }}
      />
      <FormularioCuartel
        modo="editar"
        especies={especies}
        sectores={sectores}
        valores={{
          id: c.id,
          periodo_id: c.periodo_id,
          codigo: c.codigo,
          nombre: c.nombre,
          superficie_ha: c.superficie_ha,
          estado_productivo: c.estado_productivo,
          sistema_riego: c.sistema_riego,
          observaciones: c.observaciones,
          especie_id: c.especie_id,
          variedad_id: c.variedad_id,
          portainjerto: c.portainjerto,
          anio_plantacion: c.anio_plantacion,
          distancia_hileras_m: c.distancia_hileras_m,
          distancia_plantas_m: c.distancia_plantas_m,
          plantas: c.plantas,
          sectores: c.sectores_ids,
        }}
      />
    </div>
  );
}
