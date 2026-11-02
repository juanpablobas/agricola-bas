import { exigirRol, puede } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { FormCuadrilla, FormLabor } from "../FormCatalogo";
import { alternarActivo } from "../acciones";

export const metadata = { title: "Cuadrillas y labores" };

export default async function Catalogos() {
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const [{ data: cuadrillas }, { data: labores }] = await Promise.all([
    supabase.from("cuadrilla").select("id, nombre, jefe, tipo, telefono, activo").order("nombre"),
    supabase.from("labor_tipo").select("id, nombre, activo").order("nombre"),
  ]);
  const alterna = (tabla: string, x: any) => edita && (
    <form action={alternarActivo}>
      <input type="hidden" name="tabla" value={tabla} /><input type="hidden" name="id" value={x.id} /><input type="hidden" name="activo" value={String(x.activo)} />
      <button className="text-sm hover:underline">{x.activo ? "Desactivar" : "Activar"}</button>
    </form>
  );
  return (
    <>
      <Encabezado titulo="Cuadrillas y labores" subtitulo="Las listas que aparecen al planificar y registrar." volver={{ href: "/labores", texto: "Labores" }} />
      <section className="tarjeta mb-4">
        <h2 className="p-4 pb-2 font-semibold">Cuadrillas</h2>
        {(cuadrillas ?? []).length === 0 && <p className="px-4 pb-3 text-sm text-tinta-suave">Todavía no hay cuadrillas. Agrega la primera abajo.</p>}
        {(cuadrillas ?? []).map((c: any) => (
          <div key={c.id} className={`flex flex-wrap items-center justify-between gap-2 border-t border-linea px-4 py-2.5 ${c.activo ? "" : "text-tinta-suave"}`}>
            <div>
              <p className="font-medium">{c.nombre}{!c.activo && <span className="pastilla ml-2 bg-linea/60">inactiva</span>}</p>
              <p className="text-sm text-tinta-suave">{[c.jefe && `Jefe: ${c.jefe}`, c.tipo === "propia" ? "Personal propio" : "Contratista", c.telefono].filter(Boolean).join(" · ")}</p>
            </div>
            {alterna("cuadrilla", c)}
          </div>
        ))}
        {edita && <div className="border-t border-linea p-4"><FormCuadrilla /></div>}
      </section>
      <section className="tarjeta">
        <h2 className="p-4 pb-2 font-semibold">Labores</h2>
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {(labores ?? []).map((l: any) => (
            <span key={l.id} className={`inline-flex items-center gap-2 rounded-full border border-linea px-3 py-1 text-sm ${l.activo ? "" : "text-tinta-suave line-through"}`}>
              {l.nombre}{alterna("labor_tipo", l)}
            </span>
          ))}
        </div>
        {edita && <div className="border-t border-linea p-4"><FormLabor /></div>}
      </section>
    </>
  );
}
