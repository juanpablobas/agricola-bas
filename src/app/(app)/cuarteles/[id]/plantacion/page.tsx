import { exigirRol } from "@/lib/auth";
import { cargarEspecies, cargarSectores } from "@/lib/catalogos";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { FormularioCuartel } from "../../FormularioCuartel";
import { cargarCuartel } from "../cargar";

export const metadata = { title: "Cambio de plantación" };

export default async function CambioPlantacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const [c, especies, sectores] = await Promise.all([cargarCuartel(supabase, id), cargarEspecies(supabase), cargarSectores(supabase)]);
  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado titulo={`Cambio de plantación · ${c.codigo}`} volver={{ href: `/cuarteles/${id}`, texto: `Cuartel ${c.codigo}` }} />
      <div className="mb-4">
        <Aviso>
          Hoy el cuartel tiene <strong>{c.especie} {c.variedad ?? "(sin variedad)"}</strong>. Esa plantación queda en el historial y los
          costos y cosechas anteriores siguen asociados a ella.
        </Aviso>
      </div>
      <FormularioCuartel
        modo="plantacion"
        especies={especies}
        sectores={sectores}
        valores={{ id: c.id, distancia_hileras_m: c.distancia_hileras_m, distancia_plantas_m: c.distancia_plantas_m }}
      />
    </div>
  );
}
