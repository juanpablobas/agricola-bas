import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { fecha, num } from "@/lib/formato";
import { hoyChile } from "@/lib/semana";
import { leerTodo } from "@/lib/programas";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { cargarOpciones } from "../labores/lib";
import { borrarCosecha } from "./acciones";

export const metadata = { title: "Cosecha" };

const DESTINO: Record<string, string> = { exportadora: "Exportadora", mercado_nacional: "Mercado nacional", proceso: "Proceso", otro: "Otro" };

export default async function Cosecha({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const q = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const hoy = hoyChile();

  const { data: temporada } = await supabase.from("temporada").select("nombre, inicio, termino").lte("inicio", hoy).gte("termino", hoy).maybeSingle();
  const desde = temporada?.inicio ?? `${hoy.slice(0, 4)}-01-01`;
  const hasta = temporada?.termino ?? hoy;

  const op = await cargarOpciones(supabase);
  const [regs, { data: cuarteles }] = await Promise.all([
    leerTodo<any>((d, h) => supabase.from("cosecha").select("id, fecha, cuartel_id, cuadrilla_id, kilos, cantidad, unidad, destino, observacion, creado_en").gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: false }).order("creado_en", { ascending: false }).range(d, h)),
    supabase.from("v_cuartel").select("id, codigo, especie, variedad, superficie_ha").range(0, 999),
  ]);
  const ids = regs.map((r) => r.id);
  const baldesDe = new Map<string, { persona: string; baldes: number }[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from("cosecha_balde").select("cosecha_id, persona, baldes").in("cosecha_id", ids.slice(i, i + 200)).order("persona");
    for (const b of (data ?? []) as any[]) baldesDe.set(b.cosecha_id, [...(baldesDe.get(b.cosecha_id) ?? []), { persona: b.persona, baldes: b.baldes }]);
  }

  const cuartelPorId = new Map<string, any>((cuarteles ?? []).map((c: any) => [c.id as string, c] as [string, any]));
  // Resumen por especie y variedad (las hectáreas se cuentan una sola vez por cuartel con cosecha)
  const resumen = new Map<string, { nombre: string; kilos: number; bins: number; baldes: number; registros: number; cuarteles: Set<string> }>();
  for (const r of regs) {
    const c = cuartelPorId.get(r.cuartel_id);
    const k = `${c?.especie ?? "—"} ${c?.variedad ?? ""}`.trim();
    const g = resumen.get(k) ?? { nombre: k, kilos: 0, bins: 0, baldes: 0, registros: 0, cuarteles: new Set<string>() };
    g.registros++;
    g.kilos += Number(r.kilos ?? 0);
    if (r.unidad === "bins") g.bins += Number(r.cantidad ?? 0);
    for (const b of baldesDe.get(r.id) ?? []) g.baldes += b.baldes;
    g.cuarteles.add(r.cuartel_id);
    resumen.set(k, g);
  }
  const filas = [...resumen.values()].sort((a, b) => b.kilos - a.kilos || a.nombre.localeCompare(b.nombre, "es")).map((g) => {
    const ha = [...g.cuarteles].reduce((s, id) => s + Number(cuartelPorId.get(id)?.superficie_ha ?? 0), 0);
    return { ...g, ha };
  });

  return (
    <>
      <Encabezado
        titulo="Cosecha"
        subtitulo={temporada ? `Temporada ${temporada.nombre}: lo cosechado por cuartel.` : "Lo cosechado por cuartel."}
        acciones={edita ? <Link href="/cosecha/registrar" className="boton"><Icono nombre="mas" className="size-4" />Registrar cosecha</Link> : undefined}
      />
      {q.ok === "1" && <div className="mb-3"><Aviso tipo="ok">Cosecha guardada.</Aviso></div>}
      {q.ok === "borrada" && <div className="mb-3"><Aviso tipo="ok">Registro borrado.</Aviso></div>}

      {regs.length === 0 ? (
        <Aviso>Todavía no hay cosechas registradas en esta temporada. {edita ? "Cuando empiece la cosecha, anótala con “Registrar cosecha”." : ""}</Aviso>
      ) : (
        <>
          <section className="tarjeta mb-5 overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Especie y variedad</th><th className="text-right">Kilos</th><th className="text-right">Bins</th><th className="text-right">Baldes</th><th className="text-right">Kg por ha</th><th className="text-right">Registros</th></tr></thead>
              <tbody>
                {filas.map((g) => (
                  <tr key={g.nombre}>
                    <td className="font-medium">{g.nombre}</td>
                    <td className="text-right">{g.kilos > 0 ? num(g.kilos, 0) : "—"}</td>
                    <td className="text-right">{g.bins > 0 ? num(g.bins, 0) : "—"}</td>
                    <td className="text-right">{g.baldes > 0 ? num(g.baldes, 0) : "—"}</td>
                    <td className="text-right">{g.kilos > 0 && g.ha > 0 ? num(g.kilos / g.ha, 0) : "—"}</td>
                    <td className="text-right text-tinta-suave">{g.registros}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="mb-5 text-xs text-tinta-suave">Los kilos por hectárea usan las hectáreas de los cuarteles donde ya hubo cosecha. Si todavía no se cosecha todo el cuartel, el número es parcial.</p>

          <section className="tarjeta">
            <h2 className="p-4 pb-2 font-semibold">Cosechas registradas</h2>
            {regs.map((r) => {
              const bs = baldesDe.get(r.id) ?? [];
              const totBaldes = bs.reduce((s, b) => s + b.baldes, 0);
              return (
                <div key={r.id} className="border-t border-linea px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{fecha(r.fecha)} · {op.nombres.cuartel.get(r.cuartel_id) ?? "Cuartel"}</p>
                      <p className="text-sm text-tinta-suave">
                        {[r.kilos != null ? `${num(Number(r.kilos), 0)} kg` : null, r.cantidad != null ? `${num(Number(r.cantidad), 0)} ${r.unidad}` : null, totBaldes > 0 ? `${num(totBaldes)} baldes` : null].filter(Boolean).join(" · ")}
                        {" · "}{DESTINO[r.destino] ?? r.destino}
                        {r.cuadrilla_id ? ` · ${op.nombres.cuadrilla.get(r.cuadrilla_id) ?? ""}` : ""}
                      </p>
                      {r.observacion && <p className="text-sm text-tinta-suave">{r.observacion}</p>}
                    </div>
                    {edita && (
                      <form action={borrarCosecha}><input type="hidden" name="id" value={r.id} /><button className="text-sm text-alerta hover:underline">Borrar</button></form>
                    )}
                  </div>
                  {bs.length > 0 && (
                    <details className="mt-1 text-sm">
                      <summary className="cursor-pointer text-verde">Ver baldes por persona ({bs.length})</summary>
                      <ul className="mt-1 columns-2 text-tinta-suave">{bs.map((b, i) => <li key={i}>{b.persona}: {b.baldes}</li>)}</ul>
                    </details>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </>
  );
}
