import { exigirRol, puede } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { FormCuadrilla, FormLabor, FormTrabajador } from "../FormCatalogo";
import { alternarActivo, borrarCatalogo, editarCuadrilla, editarLaborTipo, editarTrabajador } from "../acciones";
import { CATEGORIAS } from "../modelo";
import { Aviso } from "@/components/Aviso";

export const metadata = { title: "Catálogo de labores" };

export default async function Catalogos({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const [{ data: cuadrillas }, { data: labores }, { data: trabajadores }, { data: usuarios }] = await Promise.all([
    supabase.from("cuadrilla").select("id, nombre, jefe, tipo, telefono, rut, activo").order("nombre"),
    supabase.from("labor_tipo").select("id, nombre, activo, categoria, especies").order("nombre"),
    supabase.from("trabajador").select("id, nombre, vive_en_campo, telefono, perfil_id, activo").order("nombre"),
    supabase.from("perfil").select("id, nombre, email").eq("activo", true).order("nombre"),
  ]);
  const { data: especies } = await supabase.from("especie").select("id, nombre").order("nombre");
  const nombreEspecie = new Map(((especies ?? []) as any[]).map((e) => [e.id as string, e.nombre as string]));
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
      <Encabezado titulo="Catálogo de labores" subtitulo="Labores por categoría, contratistas, cuadrillas y trabajadores." volver={{ href: "/labores", texto: "Labores" }} />
      {q.ok && <div className="mb-3"><Aviso tipo="ok">Guardado.</Aviso></div>}
      {q.error === "uso" && <div className="mb-3"><Aviso tipo="error">Esa labor ya tiene registros o planes y no se puede borrar. Mejor desactívala: deja de aparecer en las listas y se conserva el historial.</Aviso></div>}
      {q.error === "repetida" && <div className="mb-3"><Aviso tipo="error">Ya existe una labor con ese nombre.</Aviso></div>}
      {q.error && q.error !== "uso" && q.error !== "repetida" && <div className="mb-3"><Aviso tipo="error">No se pudo guardar. Revisa que el nombre no esté vacío ni repetido.</Aviso></div>}
      <section className="tarjeta mb-4">
        <h2 className="p-4 pb-2 font-semibold">Contratistas y cuadrillas</h2>
        {(cuadrillas ?? []).length === 0 && <p className="px-4 pb-3 text-sm text-tinta-suave">Todavía no hay cuadrillas. Agrega la primera abajo.</p>}
        {(cuadrillas ?? []).map((c: any) => (
          <div key={c.id} className={`border-t border-linea px-4 py-2.5 ${c.activo ? "" : "text-tinta-suave"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{c.nombre}{!c.activo && <span className="pastilla ml-2 bg-linea/60">inactiva</span>}</p>
                <p className="text-sm text-tinta-suave">{[c.jefe && `Jefe: ${c.jefe}`, c.tipo === "propia" ? "Personal propio" : "Contratista", c.rut && `RUT ${c.rut}`, c.telefono].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex items-center gap-4">{alterna("cuadrilla", c)}{borra("cuadrilla", c)}</div>
            </div>
            {edita && (
              <details className="mt-1">
                <summary className="cursor-pointer text-sm text-verde">Editar</summary>
                <form action={editarCuadrilla} className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="nombre" defaultValue={c.nombre} required className="entrada col-span-2" aria-label="Nombre" />
                  <input name="jefe" defaultValue={c.jefe ?? ""} placeholder="Jefe" className="entrada" aria-label="Jefe" />
                  <input name="rut" defaultValue={c.rut ?? ""} placeholder="RUT" className="entrada" aria-label="RUT" />
                  <input name="telefono" defaultValue={c.telefono ?? ""} placeholder="Teléfono" inputMode="tel" className="entrada" aria-label="Teléfono" />
                  <select name="tipo" defaultValue={c.tipo} className="entrada" aria-label="Tipo"><option value="contratista">Contratista</option><option value="propia">Propia</option></select>
                  <button className="boton-secundario col-span-2 sm:col-span-6 sm:w-fit">Guardar</button>
                </form>
              </details>
            )}
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
                <select name="perfil" defaultValue={t.perfil_id ?? ""} className="entrada w-48" aria-label="Usuario de la app (para sus avisos)">
                  <option value="">Sin usuario de la app</option>
                  {(usuarios ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
                </select>
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
      <section id="labores" className="tarjeta">
        <h2 className="p-4 pb-1 font-semibold">Labores por categoría</h2>
        <p className="px-4 pb-3 text-sm text-tinta-suave">Toca una labor para cambiar su nombre, su categoría o a qué especies corresponde. Si no marcas especies, aparece para todas.</p>
        {CATEGORIAS.map((cat) => {
          const ls = ((labores ?? []) as any[]).filter((l) => (l.categoria ?? "Otras") === cat);
          if (ls.length === 0) return null;
          return (
            <div key={cat} className="border-t border-linea px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-suave">{cat}</p>
              <div className="flex flex-col gap-1">
                {ls.map((l) => (
                  <details key={l.id} className="group rounded-lg border border-linea">
                    <summary className={`flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-2 px-3 text-sm ${l.activo ? "" : "text-tinta-suave line-through"}`}>
                      <span className="font-medium">{l.nombre}</span>
                      {(l.especies ?? []).length > 0 && <span className="text-xs text-tinta-suave">{(l.especies as string[]).map((e) => nombreEspecie.get(e)).filter(Boolean).join(", ")}</span>}
                    </summary>
                    {edita && (
                      <div className="border-t border-linea p-3">
                        <form action={editarLaborTipo} className="flex flex-col gap-3">
                          <input type="hidden" name="id" value={l.id} />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input name="nombre" defaultValue={l.nombre} required className="entrada" aria-label="Nombre de la labor" />
                            <select name="categoria" defaultValue={l.categoria ?? "Otras"} className="entrada" aria-label="Categoría">{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {((especies ?? []) as any[]).map((e) => (
                              <label key={e.id} className="inline-flex items-center gap-1.5 rounded-full border border-linea px-2.5 py-1 text-sm">
                                <input type="checkbox" name="especies" value={e.id} defaultChecked={(l.especies ?? []).includes(e.id)} className="size-4 accent-verde" />{e.nombre}
                              </label>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-4"><button className="boton-secundario">Guardar</button>{alterna("labor_tipo", l)}{borra("labor_tipo", l)}</div>
                        </form>
                      </div>
                    )}
                  </details>
                ))}
              </div>
            </div>
          );
        })}
        {edita && <div className="border-t border-linea p-4"><FormLabor /></div>}
      </section>
    </>
  );
}
