import Link from "next/link";
import { exigirRol } from "@/lib/auth";
import { fechaHora } from "@/lib/formato";
import { TABLAS, ACCIONES } from "@/lib/etiquetas";
import { Encabezado } from "@/components/Encabezado";

export const metadata = { title: "Actividad" };

const POR_PAGINA = 50;

function resumen(a: any) {
  const d = a.despues ?? a.antes ?? {};
  return d.codigo ?? d.nombre ?? d.email ?? "";
}

export default async function Actividad({ searchParams }: { searchParams: Promise<{ p?: string; tabla?: string }> }) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.p ?? 1));
  const { supabase } = await exigirRol("administrador", "propietario");

  let q = supabase
    .from("v_actividad")
    .select("id, tabla, registro_id, accion, antes, despues, fecha, usuario_id, usuario_nombre", { count: "exact" })
    .order("fecha", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (sp.tabla) q = q.eq("tabla", sp.tabla);
  const { data, count } = await q;
  const paginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));
  const enlace = (p: number) => `/actividad?p=${p}${sp.tabla ? `&tabla=${sp.tabla}` : ""}`;

  return (
    <>
      <Encabezado titulo="Actividad" subtitulo="Cada creación, cambio y eliminación queda registrada con su autor. Este registro no se puede editar." />

      <form method="get" className="mb-4 flex gap-2">
        <select name="tabla" defaultValue={sp.tabla ?? ""} className="entrada max-w-xs" aria-label="Tipo de registro">
          <option value="">Todos los registros</option>
          {Object.entries(TABLAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="boton-secundario">Filtrar</button>
      </form>

      <section className="tarjeta overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((a: any) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap tabular-nums text-tinta-suave">{fechaHora(a.fecha)}</td>
                  <td>{a.usuario_nombre || (a.usuario_id ? "Usuario" : "Sistema / carga inicial")}</td>
                  <td>{ACCIONES[a.accion] ?? a.accion}</td>
                  <td>
                    {TABLAS[a.tabla] ?? a.tabla}
                    {resumen(a) && <span className="text-tinta-suave"> · {resumen(a)}</span>}
                    {a.tabla === "cuartel" && a.accion !== "DELETE" && (
                      <Link href={`/cuarteles/${a.registro_id}`} className="ml-2 text-verde hover:underline">ver</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {paginas > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm">
          {pagina > 1 ? <Link href={enlace(pagina - 1)} className="boton-secundario">Anterior</Link> : <span />}
          <span className="text-tinta-suave">Página {pagina} de {paginas}</span>
          {pagina < paginas ? <Link href={enlace(pagina + 1)} className="boton-secundario">Siguiente</Link> : <span />}
        </nav>
      )}
    </>
  );
}
