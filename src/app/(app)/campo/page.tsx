import { obtenerSesion, puede } from "@/lib/auth";
import { fecha } from "@/lib/formato";
import { colorEspecie } from "@/lib/etiquetas";
import { Encabezado } from "@/components/Encabezado";
import { FormularioCampo, FormularioTemporada, FormularioCentroCosto, FormularioEspecie, FormularioVariedad } from "./Formularios";

export const metadata = { title: "Campo" };

export default async function Campo() {
  const { supabase, perfil } = await obtenerSesion();
  const agricola = puede(perfil.rol, "administrador", "enc_agricola");
  const administrativo = puede(perfil.rol, "administrador", "enc_administrativo");

  const [{ data: campo }, { data: temporadas }, { data: centros }, { data: especies }] = await Promise.all([
    supabase.from("campo").select("*").maybeSingle(),
    supabase.from("temporada").select("*").order("inicio", { ascending: false }),
    supabase.from("centro_costo").select("id, codigo, nombre, tipo, activo").order("tipo", { ascending: false }).order("codigo"),
    supabase.from("especie").select("id, nombre, grupo, variedad(id, nombre)").order("nombre"),
  ]);
  const hoy = new Date().toISOString().slice(0, 10);
  const generales = (centros ?? []).filter((c: any) => c.tipo === "general");
  const deCuartel = (centros ?? []).filter((c: any) => c.tipo === "cuartel");

  return (
    <>
      <Encabezado titulo="Campo" subtitulo="Datos generales, temporadas, centros de costo y catálogo de especies." />

      <section className="tarjeta p-5">
        <h2 className="mb-4 font-semibold">Datos generales</h2>
        <FormularioCampo campo={campo} editable={agricola} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="tarjeta p-5">
          <h2 className="font-semibold">Temporadas agrícolas</h2>
          <p className="mb-3 text-sm text-tinta-suave">Cada gasto, labor y cosecha queda asociado a la temporada de su fecha.</p>
          <ul className="mb-4 divide-y divide-linea">
            {(temporadas ?? []).map((t: any) => {
              const vigente = t.inicio <= hoy && t.termino >= hoy;
              return (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{t.nombre}</span>
                  <span className="flex items-center gap-2 text-tinta-suave">
                    {fecha(t.inicio)} al {fecha(t.termino)}
                    {vigente && <span className="pastilla bg-verde-claro text-verde-oscuro">Vigente</span>}
                    {t.estado === "cerrada" && <span className="pastilla bg-papel">Cerrada</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          {administrativo && <FormularioTemporada />}
        </section>

        <section className="tarjeta p-5">
          <h2 className="font-semibold">Centros de costo</h2>
          <p className="mb-3 text-sm text-tinta-suave">
            Cada cuartel tiene su centro de costo propio ({deCuartel.length}). Los generales reciben los gastos que se prorratean.
          </p>
          <ul className="mb-4 divide-y divide-linea">
            {generales.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="font-mono text-xs text-tinta-suave">{c.codigo}</span> · {c.nombre}</span>
              </li>
            ))}
          </ul>
          {administrativo && <FormularioCentroCosto />}
        </section>
      </div>

      <section className="tarjeta mt-5 p-5">
        <h2 className="mb-3 font-semibold">Especies y variedades</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(especies ?? []).map((e: any) => (
            <li key={e.id} className="rounded-lg border border-linea p-3">
              <p className="flex items-center gap-2 font-medium">
                <span className="size-2.5 rounded-full" style={{ background: colorEspecie(e.nombre) }} />
                {e.nombre}
                {e.grupo && <span className="text-xs font-normal text-tinta-suave">· {e.grupo}</span>}
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                {(e.variedad ?? []).map((v: any) => v.nombre).sort().join(", ") || "Sin variedades"}
              </p>
            </li>
          ))}
        </ul>
        {agricola && (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Agregar variedad</h3>
              <FormularioVariedad especies={(especies ?? []).map((e: any) => ({ id: e.id, nombre: e.nombre }))} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Agregar especie</h3>
              <FormularioEspecie />
            </div>
          </div>
        )}
      </section>
    </>
  );
}
