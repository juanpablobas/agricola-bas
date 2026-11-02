import { exigirRol } from "@/lib/auth";
import { cargarEspecies, cargarSectores } from "@/lib/catalogos";
import { Encabezado } from "@/components/Encabezado";
import { FormularioCuartel } from "../FormularioCuartel";

export const metadata = { title: "Nuevo cuartel" };

export default async function NuevoCuartel() {
  const { supabase } = await exigirRol("administrador", "enc_agricola");
  const [especies, sectores] = await Promise.all([cargarEspecies(supabase), cargarSectores(supabase)]);
  return (
    <div className="mx-auto max-w-3xl">
      <Encabezado titulo="Nuevo cuartel" volver={{ href: "/cuarteles", texto: "Cuarteles" }} />
      <FormularioCuartel modo="nuevo" especies={especies} sectores={sectores} />
    </div>
  );
}
