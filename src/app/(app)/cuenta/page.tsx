import { obtenerSesion } from "@/lib/auth";
import { etiquetaRol } from "@/lib/etiquetas";
import { Encabezado } from "@/components/Encabezado";
import { FormularioNombre, FormularioClave } from "./Formularios";

export const metadata = { title: "Mi cuenta" };

export default async function Cuenta() {
  const { perfil } = await obtenerSesion();
  return (
    <div className="mx-auto max-w-xl">
      <Encabezado titulo="Mi cuenta" subtitulo={`${perfil.email} · ${etiquetaRol(perfil.rol)}`} />
      <section className="tarjeta p-5">
        <FormularioNombre nombre={perfil.nombre} />
      </section>
      <section className="tarjeta mt-5 p-5">
        <h2 className="mb-3 font-semibold">Contraseña</h2>
        <FormularioClave />
      </section>
    </div>
  );
}
