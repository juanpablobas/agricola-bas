import { exigirRol } from "@/lib/auth";
import { fecha } from "@/lib/formato";
import { ROLES, etiquetaRol } from "@/lib/etiquetas";
import { Encabezado } from "@/components/Encabezado";
import { BotonEnviar } from "@/components/BotonEnviar";
import { FormularioUsuario } from "./FormularioUsuario";
import { cambiarRol, cambiarEstadoUsuario } from "./acciones";
import { crearClienteAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "Usuarios" };

export default async function Usuarios() {
  const { supabase, user } = await exigirRol("administrador");
  const { data: perfiles } = await supabase.from("perfil").select("*").order("activo", { ascending: false }).order("nombre");
  // Celulares con avisos activados por usuario (la tabla solo la ve cada dueño, por eso se lee con la llave de servicio)
  const conAvisos = new Map<string, number>();
  try {
    const { data: subs } = await crearClienteAdmin().from("push_suscripcion").select("user_id");
    for (const s of (subs ?? []) as { user_id: string }[]) conAvisos.set(s.user_id, (conAvisos.get(s.user_id) ?? 0) + 1);
  } catch { /* si falla, la columna queda en blanco */ }

  return (
    <>
      <Encabezado titulo="Usuarios" subtitulo="Quién entra a la plataforma y qué puede hacer cada uno." />

      <section className="tarjeta p-5">
        <h2 className="mb-4 font-semibold">Nuevo usuario</h2>
        <FormularioUsuario />
      </section>

      <section className="tarjeta mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Avisos</th>
                <th className="hidden sm:table-cell">Desde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(perfiles ?? []).map((p: any) => (
                <tr key={p.id} className={p.activo ? "" : "opacity-55"}>
                  <td>
                    <p className="font-medium">{p.nombre || "Sin nombre"}{p.id === user.id && <span className="text-tinta-suave"> (tú)</span>}</p>
                    <p className="text-xs text-tinta-suave">{p.email}</p>
                  </td>
                  <td>
                    {p.id === user.id ? (
                      etiquetaRol(p.rol)
                    ) : (
                      <form action={cambiarRol} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        <select name="rol" defaultValue={p.rol} className="entrada py-1.5 text-sm" aria-label={`Rol de ${p.nombre}`}>
                          {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
                        </select>
                        <BotonEnviar className="boton-secundario min-h-9 px-3 py-1.5" pendiente="…">Cambiar</BotonEnviar>
                      </form>
                    )}
                  </td>
                  <td className="text-sm">{conAvisos.get(p.id) ? <span className="text-verde">Activados ({conAvisos.get(p.id)})</span> : <span className="text-tinta-suave">Sin activar</span>}</td>
                  <td className="hidden text-tinta-suave sm:table-cell">{fecha(p.creado_en)}</td>
                  <td className="text-right">
                    {p.id !== user.id && (
                      <form action={cambiarEstadoUsuario}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="activo" value={p.activo ? "false" : "true"} />
                        <BotonEnviar className={p.activo ? "boton-peligro min-h-9 px-3 py-1.5" : "boton-secundario min-h-9 px-3 py-1.5"} pendiente="…">
                          {p.activo ? "Desactivar" : "Reactivar"}
                        </BotonEnviar>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r.valor} className="rounded-lg border border-linea bg-white/60 p-3 text-sm">
            <p className="font-medium">{r.etiqueta}</p>
            <p className="text-tinta-suave">{r.descripcion}</p>
          </div>
        ))}
      </section>
    </>
  );
}
