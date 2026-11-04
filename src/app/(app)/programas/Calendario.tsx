// Calendario de la temporada: cada programa en una fila, cada mes en una columna, cada aplicación como un número con color según cómo va.
import Link from "next/link";
import { MESES_TEMPORADA, NOMBRE_MES } from "@/lib/programas";
import type { Pendiente } from "@/lib/seguimiento";

type App = { id: string; programa_id: string; orden: number; titulo: string | null; mes: number | null };
type Estado = "hecha" | "atrasada" | "reprogramada" | "este_mes" | "proxima" | "previa" | "omitida";

const ESTILO: Record<Estado, { clase: string; texto: string }> = {
  hecha: { clase: "bg-verde text-white", texto: "Hecha" },
  atrasada: { clase: "bg-alerta text-white", texto: "Atrasada" },
  reprogramada: { clase: "bg-verde-claro text-verde-oscuro ring-1 ring-verde/40", texto: "Postergada" },
  este_mes: { clase: "bg-ambar text-white", texto: "Toca este mes" },
  proxima: { clase: "bg-white text-tinta ring-1 ring-linea", texto: "Próxima" },
  previa: { clase: "bg-linea/70 text-tinta-suave", texto: "Sin registro (antes de la app)" },
  omitida: { clase: "bg-papel text-tinta-suave line-through", texto: "No se hará" },
};
const PRIORIDAD: Estado[] = ["atrasada", "reprogramada", "este_mes", "proxima", "previa"];

export function estadoDe(app: App, pend: Pendiente[], nVariedades: number): { estado: Estado; faltan: string[] } {
  const activos = pend.filter((p) => p.situacion !== "omitida");
  if (pend.length > 0 && activos.length === 0) return { estado: "omitida", faltan: [] };
  if (activos.length === 0) return { estado: nVariedades > 0 ? "hecha" : "proxima", faltan: [] };
  const sits = new Set<string>(activos.map((p) => (p.situacion === "ignorar" ? "previa" : p.situacion)));
  const estado = PRIORIDAD.find((e) => sits.has(e)) ?? "proxima";
  return { estado, faltan: activos.map((p) => p.variedad) };
}

export function CalendarioProgramas({
  programas,
  apps,
  pendientes,
  variedadesPorPrograma,
  mesActual,
}: {
  programas: { id: string; nombre: string }[];
  apps: App[];
  pendientes: Pendiente[];
  variedadesPorPrograma: Map<string, number>;
  mesActual: number;
}) {
  const pendDe = new Map<string, Pendiente[]>();
  for (const p of pendientes) pendDe.set(p.app_id, [...(pendDe.get(p.app_id) ?? []), p]);
  const usados = new Set<Estado>();

  const filas = programas.map((prog) => {
    const nV = variedadesPorPrograma.get(prog.id) ?? 0;
    const porMes = new Map<number, { app: App; estado: Estado; faltan: string[] }[]>();
    for (const a of apps.filter((x) => x.programa_id === prog.id && x.mes).sort((x, y) => x.orden - y.orden)) {
      const e = estadoDe(a, pendDe.get(a.id) ?? [], nV);
      usados.add(e.estado);
      porMes.set(a.mes!, [...(porMes.get(a.mes!) ?? []), { app: a, ...e }]);
    }
    return { prog, porMes };
  });

  return (
    <section className="tarjeta mb-5 overflow-hidden">
      <div className="p-4 pb-2">
        <h2 className="font-semibold">Calendario de la temporada</h2>
        <p className="text-sm text-tinta-suave">Cada número es una aplicación del programa. Tócalo para ver el programa completo.</p>
      </div>

      {/* Celular: mes por mes hacia abajo, empezando por el actual */}
      <div className="sm:hidden">
        {(() => {
          const i = Math.max(0, MESES_TEMPORADA.indexOf(mesActual));
          const siguientes = MESES_TEMPORADA.slice(i);
          const anteriores = MESES_TEMPORADA.slice(0, i);
          const Mes = ({ m }: { m: number }) => {
            const fs = filas.filter((f) => (f.porMes.get(m) ?? []).length > 0);
            return (
              <div className={`border-t border-linea px-4 py-3 ${m === mesActual ? "bg-ambar-claro/40" : ""}`}>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <span className="inline-block first-letter:uppercase">{NOMBRE_MES[m]}</span>
                  {m === mesActual && <span className="pastilla bg-ambar text-white">Este mes</span>}
                </p>
                {fs.length === 0 ? (
                  <p className="text-xs text-tinta-suave">Sin aplicaciones.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {fs.map(({ prog, porMes }) => (
                      <li key={prog.id}>
                        <Link href={`/programas/${prog.id}`} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-linea active:bg-papel">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{prog.nombre}</span>
                          <span className="flex shrink-0 flex-wrap justify-end gap-1">
                            {(porMes.get(m) ?? []).map(({ app, estado }) => (
                              <span key={app.id} title={ESTILO[estado].texto} className={`grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums ${ESTILO[estado].clase}`}>{app.orden}</span>
                            ))}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          };
          return (
            <>
              {siguientes.map((m) => <Mes key={m} m={m} />)}
              {anteriores.length > 0 && (
                <details className="group border-t border-linea">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 px-4 text-sm text-tinta-suave">
                    <span className="transition group-open:rotate-90">›</span> Meses anteriores ({NOMBRE_MES[anteriores[0]]} a {NOMBRE_MES[anteriores.at(-1)!]})
                  </summary>
                  {anteriores.map((m) => <Mes key={m} m={m} />)}
                </details>
              )}
            </>
          );
        })()}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-48 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-tinta-suave">Programa</th>
              {MESES_TEMPORADA.map((m) => (
                <th key={m} className={`px-1 py-2 text-center text-xs font-semibold uppercase tracking-wide ${m === mesActual ? "rounded-t-lg bg-ambar-claro text-ambar" : "text-tinta-suave"}`}>
                  {NOMBRE_MES[m].slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(({ prog, porMes }) => (
              <tr key={prog.id} className="border-t border-linea">
                <td className="sticky left-0 z-10 w-48 bg-white px-3 py-2.5">
                  <Link href={`/programas/${prog.id}`} className="line-clamp-2 font-medium leading-snug hover:text-verde">{prog.nombre}</Link>
                </td>
                {MESES_TEMPORADA.map((m) => (
                  <td key={m} className={`px-1 py-2 align-middle ${m === mesActual ? "bg-ambar-claro/50" : ""}`}>
                    <div className="flex flex-wrap justify-center gap-1">
                      {(porMes.get(m) ?? []).map(({ app, estado, faltan }) => (
                        <Link
                          key={app.id}
                          href={`/programas/${prog.id}`}
                          title={`${app.orden}. ${app.titulo ?? ""} · ${ESTILO[estado].texto}${faltan.length && estado !== "previa" ? ` · falta en ${faltan.join(", ")}` : ""}`}
                          className={`grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums ${ESTILO[estado].clase}`}
                        >
                          {app.orden}
                        </Link>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-linea px-4 py-3 text-xs text-tinta-suave">
        {(Object.keys(ESTILO) as Estado[]).filter((e) => usados.has(e)).map((e) => (
          <li key={e} className="flex items-center gap-1.5">
            <span className={`size-3.5 rounded-full ${ESTILO[e].clase}`} />
            {ESTILO[e].texto}
          </li>
        ))}
      </ul>
    </section>
  );
}
