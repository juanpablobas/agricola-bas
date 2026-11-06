import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { hoyChile } from "@/lib/semana";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { calcularAplicacion } from "../../aplicacion";
import { FormAplicacion } from "./FormAplicacion";

export const metadata = { title: "Aplicación realizada" };

export default async function AplicacionRealizada({ params, searchParams }: { params: Promise<{ app: string }>; searchParams: Promise<{ desde?: string }> }) {
  const { app } = await params;
  const desde = (await searchParams).desde === "programas" ? "/programas" : "/labores";
  if (!/^[0-9a-f-]{36}$/i.test(app)) notFound();
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const c = await calcularAplicacion(supabase, app);
  if (!c) notFound();
  return (
    <>
      <Encabezado titulo="Aplicación realizada" subtitulo={<>{c.programa} · {c.titulo}</>} volver={{ href: desde, texto: desde === "/programas" ? "Programas" : "Labores" }} />
      {c.variedades.length === 0 ? (
        <Aviso tipo="ok">Esta aplicación ya está registrada en todas sus variedades. <Link href="/programas/historial" className="underline">Ver historial</Link></Aviso>
      ) : (
        <section className="tarjeta max-w-3xl p-4 sm:p-5">
          <FormAplicacion
            appId={app}
            volver={desde}
            hoy={hoyChile()}
            variedades={c.variedades}
            productos={c.productos.map((p) => ({ ...p, porVariedad: Object.fromEntries(p.porVariedad) }))}
            enlaceDetalle={`/programas/aplicar?v=${c.variedades[0].id}&a=${app}`}
          />
        </section>
      )}
    </>
  );
}
