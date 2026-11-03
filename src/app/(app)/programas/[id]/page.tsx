import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirRol } from "@/lib/auth";
import { num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { NOMBRE_MES, dosisPorHa, esPrincipal, leerTodo, normalizarLinea, type Aplicacion, type Linea } from "@/lib/programas";

export const metadata = { title: "Programa" };

export default async function Programa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");

  const { data: prog } = await supabase.from("programa").select("id, nombre, asesor, archivo, temporada(nombre)").eq("id", id).maybeSingle();
  if (!prog) notFound();

  const [{ data: appsRaw }, { data: pv }, { data: cuarteles }] = await Promise.all([
    supabase.from("programa_aplicacion").select("id, programa_id, orden, titulo, estado_fenologico, fecha_estimada, mes").eq("programa_id", id).order("orden"),
    supabase.from("programa_variedad").select("variedad_id, variedad(nombre)").eq("programa_id", id),
    supabase.from("v_cuartel").select("variedad_id, superficie_ha").eq("activo", true).range(0, 999),
  ]);
  const apps = (appsRaw ?? []) as Aplicacion[];
  const appIds = apps.map((a) => a.id);
  const lineas = (await leerTodo<any>((d, h) => supabase.from("programa_linea").select("*").in("aplicacion_id", appIds).order("orden").range(d, h))).map(normalizarLinea);

  const prodIds = [...new Set(lineas.map((l) => l.producto_id).filter(Boolean))] as string[];
  const { data: stocks } = prodIds.length ? await supabase.from("v_stock").select("producto_id, stock, unidad").in("producto_id", prodIds) : { data: [] as any[] };
  const stockDe = new Map<string, any>((stocks ?? []).map((s: any) => [s.producto_id as string, s]));

  const variedades = (pv ?? []) as any[];
  const ids = new Set(variedades.map((v) => v.variedad_id));
  const haTotal = (cuarteles ?? []).filter((c: any) => ids.has(c.variedad_id)).reduce((s, c: any) => s + Number(c.superficie_ha ?? 0), 0);

  const porApp = new Map<string, Linea[]>();
  for (const l of lineas) porApp.set(l.aplicacion_id, [...(porApp.get(l.aplicacion_id) ?? []), l]);

  return (
    <>
      <Encabezado
        titulo={prog.nombre}
        subtitulo={`${prog.asesor ? `Asesor: ${prog.asesor} · ` : ""}${variedades.map((v) => v.variedad?.nombre).join(", ")} · ${num(haTotal, 2)} ha`}
        volver={{ href: "/programas", texto: "Programas" }}
        acciones={<Link href={`/programas/aplicar?programa=${id}`} className="boton-secundario">Registrar aplicación</Link>}
      />
      <p className="mb-4 max-w-3xl text-sm text-tinta-suave">
        Las cantidades de esta pantalla usan el mojamiento del programa. Al calcular el pedido de productos o registrar una aplicación se usan los litros reales por variedad y mes.
        “Fija” es lo que el asesor da por seguro, “Variable” se aplica según la condición del campo y las “Alternativas” son reemplazos del producto principal.
      </p>

      <div className="flex flex-col gap-3">
        {apps.map((a) => {
          const ls = porApp.get(a.id) ?? [];
          return (
            <details key={a.id} className="tarjeta group">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
                <span className="grid size-7 place-items-center rounded-full bg-verde-claro text-sm font-semibold text-verde-oscuro">{a.orden}</span>
                <span className="font-medium">{a.titulo}</span>
                <span className="text-sm text-tinta-suave">{a.mes ? NOMBRE_MES[a.mes] : ""}{a.fecha_estimada ? ` · ${a.fecha_estimada}` : ""}</span>
                <span className="ml-auto text-xs text-tinta-suave">{ls.filter(esPrincipal).length} productos</span>
              </summary>
              <div className="overflow-x-auto px-4 pb-4">
                <table className="tabla">
                  <thead>
                    <tr><th>Producto</th><th>Para qué</th><th className="text-right">Por 100 L</th><th className="text-right">Por ha</th><th className="text-right">Para {num(haTotal, 1)} ha</th><th>Bodega</th></tr>
                  </thead>
                  <tbody>
                    {ls.map((l) => {
                      const principal = esPrincipal(l);
                      const porHa = dosisPorHa(l, null);
                      const st: any = l.producto_id ? stockDe.get(l.producto_id) : null;
                      return (
                        <tr key={l.id} className={principal ? "" : "text-tinta-suave"}>
                          <td className="min-w-44">
                            {l.relacion === "O" && <span className="mr-1 text-xs">o</span>}
                            {l.relacion === "+" && <span className="mr-1 text-xs">+</span>}
                            <span className={principal ? "font-medium" : ""}>{l.producto}</span>
                            {l.caracter && l.caracter !== "Fija" && <span className="pastilla ml-1.5 bg-ambar-claro text-ambar">{l.caracter}</span>}
                            {l.ingrediente_activo && <span className="block text-xs text-tinta-suave">{l.ingrediente_activo}</span>}
                            {l.observacion && <span className="block text-xs text-tinta-suave">{l.observacion}</span>}
                          </td>
                          <td className="min-w-32 text-sm">{l.objetivo ?? l.categoria ?? "—"}</td>
                          <td className="whitespace-nowrap text-right">{l.conc_100l !== null ? `${num(l.conc_100l, 3)} ${l.unidad ?? ""}` : "—"}</td>
                          <td className="whitespace-nowrap text-right">{num(porHa, 2)} {l.unidad ?? ""}</td>
                          <td className="whitespace-nowrap text-right">{principal ? `${num(porHa * haTotal, 1)} ${l.unidad ?? ""}` : "—"}</td>
                          <td className="whitespace-nowrap text-sm">
                            {st ? `${num(Number(st.stock), 1)} ${st.unidad ?? ""}` : <span className="text-tinta-suave">sin unir</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {ls.some((l) => l.alternativas) && (
                  <ul className="mt-2 text-xs text-tinta-suave">
                    {ls.filter((l) => l.alternativas).map((l) => <li key={l.id}><strong>{l.producto}</strong>: también {l.alternativas}</li>)}
                  </ul>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
