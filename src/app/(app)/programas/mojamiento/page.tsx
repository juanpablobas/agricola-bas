import { exigirRol, puede } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { BotonEnviar } from "@/components/BotonEnviar";
import { MESES_TEMPORADA, NOMBRE_MES, leerTodo } from "@/lib/programas";
import { guardarMojamiento } from "../acciones";

export const metadata = { title: "Mojamiento" };

export default async function Mojamiento({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const editor = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");

  const [{ data: pv }, { data: apps }, { data: reales }] = await Promise.all([
    supabase.from("programa_variedad").select("programa_id, variedad_id, variedad(nombre, especie(nombre))").range(0, 999),
    supabase.from("programa_aplicacion").select("id, programa_id, mes").range(0, 999),
    supabase.from("mojamiento_real").select("variedad_id, mes, litros_ha").range(0, 999),
  ]);
  const lineas = await leerTodo<{ aplicacion_id: string; mojam_programa: number | null }>((d, h) =>
    supabase.from("programa_linea").select("aplicacion_id, mojam_programa").order("id").range(d, h));

  const mojamPorApp = new Map<string, number[]>();
  for (const l of lineas) {
    const m = Number(l.mojam_programa);
    if (m >= 100) mojamPorApp.set(l.aplicacion_id, [...(mojamPorApp.get(l.aplicacion_id) ?? []), m]);
  }
  const moda = (xs: number[]) => {
    const c = new Map<number, number>();
    xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
  };

  // Variedades que están en algún programa (una sola vez cada una)
  const variedades = new Map<string, { id: string; nombre: string; especie: string; programas: Set<string> }>();
  for (const r of (pv ?? []) as any[]) {
    const v = variedades.get(r.variedad_id) ?? { id: r.variedad_id, nombre: r.variedad?.nombre ?? "", especie: r.variedad?.especie?.nombre ?? "", programas: new Set<string>() };
    v.programas.add(r.programa_id);
    variedades.set(r.variedad_id, v);
  }
  const lista = [...variedades.values()].sort((a, b) => a.especie.localeCompare(b.especie) || a.nombre.localeCompare(b.nombre));
  const real = new Map((reales ?? []).map((r: any) => [`${r.variedad_id}|${r.mes}`, Number(r.litros_ha)]));

  const sugerido = (v: { programas: Set<string> }, mes: number) => {
    const xs: number[] = [];
    for (const a of apps ?? []) if (a.mes === mes && v.programas.has(a.programa_id)) xs.push(...(mojamPorApp.get(a.id) ?? []));
    return xs.length ? moda(xs) : undefined;
  };

  return (
    <>
      <Encabezado titulo="Mojamiento" subtitulo="Litros de caldo por hectárea que realmente se usan, por variedad y mes." volver={{ href: "/programas", texto: "Programas" }} />
      {p.ok && <div className="mb-3"><Aviso tipo="ok">Mojamiento guardado.</Aviso></div>}
      {p.error === "rango" && <div className="mb-3"><Aviso tipo="error">Los litros por hectárea deben estar entre 100 y 10.000. No se guardó nada.</Aviso></div>}
      {p.error === "guardar" && <div className="mb-3"><Aviso tipo="error">No se pudo guardar. Intenta de nuevo.</Aviso></div>}
      <p className="mb-3 max-w-3xl text-sm text-tinta-suave">
        Escribe los litros por hectárea (por ejemplo 1.200). Con eso el programa recalcula cuánto producto lleva cada aplicación.
        Lo que dejes en blanco usa el mojamiento del programa, que aparece en gris como referencia.
      </p>

      <form action={guardarMojamiento}>
        <section className="tarjeta overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr><th>Variedad</th>{MESES_TEMPORADA.map((m) => <th key={m} className="text-center capitalize">{NOMBRE_MES[m].slice(0, 3)}</th>)}</tr>
            </thead>
            <tbody>
              {lista.map((v) => (
                <tr key={v.id}>
                  <td className="whitespace-nowrap font-medium">{v.nombre}<span className="block text-xs font-normal text-tinta-suave">{v.especie}</span></td>
                  {MESES_TEMPORADA.map((m) => {
                    const s = sugerido(v, m);
                    return (
                      <td key={m} className="px-1.5">
                        <input
                          name={`m_${v.id}_${m}`}
                          defaultValue={real.get(`${v.id}|${m}`) ?? ""}
                          placeholder={s ? String(s) : "—"}
                          inputMode="numeric"
                          disabled={!editor || s === undefined && !real.has(`${v.id}|${m}`)}
                          className="entrada w-[4.5rem] px-2 text-center disabled:bg-transparent disabled:opacity-40"
                          aria-label={`${v.nombre}, ${NOMBRE_MES[m]}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {editor && <div className="mt-4"><BotonEnviar>Guardar mojamiento</BotonEnviar></div>}
      </form>
      <p className="mt-3 text-xs text-tinta-suave">Los meses sin aplicaciones en el programa están deshabilitados.</p>
    </>
  );
}
