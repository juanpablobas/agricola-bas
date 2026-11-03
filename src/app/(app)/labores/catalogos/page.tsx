import { exigirRol, puede } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { FormCuadrilla, FormLabor, FormTrabajador } from "../FormCatalogo";
import { alternarActivo, borrarCatalogo, editarTrabajador } from "../acciones";
import { Aviso } from "@/components/Aviso";

export const metadata = { title: "Cuadrillas, trabajadores y labores" };

export default async function Catalogos({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const [{ data: cuadrillas }, { data: labores }, { data: trabajadores }] = await Promise.all([
    supabase.from("cuadrilla").select("id, nombre, jefe, tipo, telefono, activo").order("nombre"),
    supabase.from("labor_tipo").select("id, nombre, activo").order("nombre"),
    supabase.from("trabajador").select("id, nombre, vive_en_campo, telefono, activo").order("nombre"),
  ]);
  const alterna = (tabla: string, x: any) => edita && (
    <form action={alternarActivo}>
      <input type="hidden" name="tabla" value={tabla} /><input type="hidden" name="id" value={x.id} /><input type="hidden" name="activo" value={String(x.activo)} />
      <button className="text-sm hover:underline">{x.activo ? "Desactivar" : "Activar"}</button>
    </form>
  );
  const borra = (tabla: string, x: any) => edita && (
    <details className="relative">
      <summary className="cursor-pointer list-none text-sm text-alerta hover:underline">Borrar</summary>
      <form action={borrarCatalogo} className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-linea bg-superficie p-3 text-sm shadow-lg">
        <input type="hidden" name="tabla" value={tabla} /><input type="hidden" name="id" value={x.id} />
        <p className="mb-2">¿Borrar “{x.nombre}”? No se puede deshacer.</p>
        <button className="boton-peligro w-full">Sí, borrar</button>
      </form>
    </details>
  );
  return (
    <>
      <Encabezado titulo="Cuadrillas, trabajadores y labores" subtitulo="Las listas que aparecen al planificar y registrar." volver={{ href: "/labores", texto: "Labores" }} />
      {q.ok && <div className="mb-3"><Aviso tipo="ok">Guardado.</Aviso></div>}
      {q.error === "uso" && <div className="mb-3"><Aviso tipo="error">Esa labor ya tiene registros o planes y no se puede borrar. Mejor desactívala: deja de aparecer en las listas y se conserva el historial.</Aviso></div>}
      {q.error && q.error !== "uso" && <div className="mb-3"><Aviso tipo="error">No se pudo guardar. Revisa que el nombre no esté vacío ni repetido.</Aviso></div>}
      <section className="tarjeta mb-4">
        <h2 className="p-4 pb-2 font-semibold">Cuadrillas</h2>
        {(cuadrillas ?? []).length === 0 && <p className="px-4 pb-3 text-sm text-tinta-suave">Todavía no hay cuadrillas. Agrega la primera abajo.</p>}
        {(cuadrillas ?? []).map((c: any) => (
          <div key={c.id} className={`flex flex-wrap items-center justify-between gap-2 border-t border-linea px-4 py-2.5 ${c.activo ? "" : "text-tinta-suave"}`}>
            <div>
              <p className="font-medium">{c.nombre}{!c.activo && <span className="pastilla ml-2 bg-linea/60">inactiva</span>}</p>
              <p className="text-sm text-tinta-suave">{[c.jefe && `Jefe: ${c.jefe}`, c.tipo === "propia" ? "Personal propio" : "Contratista", c.telefono].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="flex items-center gap-4">{alterna("cuadrilla", c)}{borra("cuadrilla", c)}</div>
          </div>
        ))}
        {edita && <div className="border-t border-linea p-4"><FormCuadrilla /></div>}
      </section>
      <section className="tarjeta mb-4">
        <h2 className="p-4 pb-1 font-semibold">Trabajadores del campo</h2>
        <p className="px-4 pb-2 text-sm text-tinta-suave">Ellos son los que fiscalizan que el contratista haga bien cada labor.</p>
        {(trabajadores ?? []).length === 0 && <p className="px-4 pb-3 text-sm text-tinta-suave">Todavía no hay trabajadores. Agrega el primero abajo.</p>}
        {(trabajadores ?? []).map((t: any) => (
          <div key={t.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-linea px-4 py-2.5 ${t.activo ? "" : "text-tinta-suave"}`}>
            {edita ? (
              <form action={editarTrabajador} className="flex flex-1 flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={t.id} />
                <input name="nombre" defaultValue={t.nombre} required className="entrada min-w-40 flex-1" aria-label="Nombre del trabajador" />
                <input name="telefono" defaultValue={t.telefono ?? ""} inputMode="tel" placeholder="Celular" className="entrada w-36" aria-label="Celular" />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="vive" defaultChecked={t.vive_en_campo} className="size-4 accent-verde" />Vive en el campo</label>
                <button className="boton-secundario">Guardar</button>
              </form>
            ) : (
              <p className="flex-1 font-medium">{t.nombre}{t.telefono ? <span className="ml-2 text-sm font-normal text-tinta-suave">{t.telefono}</span> : null}{t.vive_en_campo && <span className="pastilla ml-2 bg-verde-claro text-verde-oscuro">vive en el campo</span>}</p>
            )}
            {!t.activo && <span className="pastilla bg-linea/60">inactivo</span>}
            <div className="flex items-center gap-4">{alterna("trabajador", t)}{borra("trabajador", t)}</div>
          </div>
        ))}
        {edita && <div className="border-t border-linea p-4"><FormTrabajador /></div>}
      </section>
      <section className="tarjeta">
        <h2 className="p-4 pb-2 font-semibold">Labores</h2>
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {(labores ?? []).map((l: any) => (
            <span key={l.id} className={`inline-flex items-center gap-2 rounded-full border border-linea px-3 py-1 text-sm ${l.activo ? "" : "text-tinta-suave line-through"}`}>
              {l.nombre}{alterna("labor_tipo", l)}{borra("labor_tipo", l)}
            </span>
          ))}
        </div>
        {edita && <div className="border-t border-linea p-4"><FormLabor /></div>}
      </section>
    </>
  );
}
