import Link from "next/link";
import { obtenerSesion, puede } from "@/lib/auth";
import { ha, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Icono } from "@/components/Icono";
import { Aviso } from "@/components/Aviso";

export const metadata = { title: "Riego" };

export default async function Riego({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const { supabase, perfil } = await obtenerSesion();
  const editor = puede(perfil.rol, "administrador", "enc_agricola");

  const [{ data: equipos }, { data: cuarteles }] = await Promise.all([
    supabase
      .from("equipo_riego")
      .select("id, numero, nombre, origen, emisor, filtro, bomba, observaciones, sector_riego(id, codigo, superficie_ha, lineas_por_hilera, caudal_emisor_lh, distancia_emisores_m, precipitacion_mmh, horas_turno, observaciones)")
      .order("numero"),
    supabase.from("cuartel_sector").select("sector_id, cuartel(id, codigo, activo)"),
  ]);

  const cuartelesPorSector = new Map<string, { id: string; codigo: string }[]>();
  for (const cs of cuarteles ?? []) {
    const c = (cs as any).cuartel;
    if (!c?.activo) continue;
    cuartelesPorSector.set(cs.sector_id, [...(cuartelesPorSector.get(cs.sector_id) ?? []), c]);
  }

  return (
    <>
      <Encabezado
        titulo="Riego"
        subtitulo="Equipos y sectores según el plano de sectorización. El volumen por turno se calcula con superficie × precipitación × horas."
      />
      {ok && <div className="mb-4"><Aviso tipo="ok">Equipo de riego actualizado.</Aviso></div>}

      <div className="flex flex-col gap-5">
        {(equipos ?? []).map((e: any) => {
          const sectores = [...(e.sector_riego ?? [])].sort((a: any, b: any) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
          const total = sectores.reduce((s: number, x: any) => s + Number(x.superficie_ha ?? 0), 0);
          return (
            <section key={e.id} className="tarjeta overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div>
                  <h2 className="font-semibold">{e.nombre}</h2>
                  <p className="text-sm text-tinta-suave">{sectores.length} sectores · {ha(total)} · {e.origen}</p>
                </div>
                {editor && (
                  <Link href={`/riego/editar?equipo=${e.numero}`} className="boton-secundario">
                    <Icono nombre="editar" className="size-4" />
                    Editar
                  </Link>
                )}
              </div>
              <dl className="grid gap-3 border-y border-linea bg-papel/50 px-5 py-3 text-sm sm:grid-cols-3">
                <div><dt className="text-xs font-medium uppercase tracking-wide text-tinta-suave">Emisor</dt><dd>{e.emisor ?? "—"}</dd></div>
                <div><dt className="text-xs font-medium uppercase tracking-wide text-tinta-suave">Filtro</dt><dd>{e.filtro ?? "—"}</dd></div>
                <div><dt className="text-xs font-medium uppercase tracking-wide text-tinta-suave">Bomba</dt><dd className={e.bomba === "Por definir" ? "text-ambar" : ""}>{e.bomba ?? "—"}</dd></div>
              </dl>
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Sector</th>
                      <th>Cuarteles</th>
                      <th className="text-right">Superficie</th>
                      <th className="text-right">Precipitación</th>
                      <th className="text-right">Turno</th>
                      <th className="text-right">Volumen turno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectores.map((s: any) => {
                      const vol = s.superficie_ha && s.precipitacion_mmh && s.horas_turno
                        ? Number(s.superficie_ha) * Number(s.precipitacion_mmh) * Number(s.horas_turno) * 10
                        : null;
                      return (
                        <tr key={s.id}>
                          <td className="font-medium">{s.codigo}</td>
                          <td>
                            {(cuartelesPorSector.get(s.id) ?? []).map((c, i) => (
                              <span key={c.id}>
                                {i > 0 && ", "}
                                <Link href={`/cuarteles/${c.id}`} className="text-verde hover:underline">{c.codigo}</Link>
                              </span>
                            ))}
                          </td>
                          <td className="text-right tabular-nums">{ha(s.superficie_ha)}</td>
                          <td className="text-right tabular-nums">{s.precipitacion_mmh ? `${num(s.precipitacion_mmh, 2)} mm/h` : "—"}</td>
                          <td className="text-right tabular-nums">{s.horas_turno ? `${num(s.horas_turno, 1)} h` : "—"}</td>
                          <td className="text-right tabular-nums">{vol ? `${num(vol, 0)} m³` : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {e.observaciones && <p className="border-t border-linea px-5 py-3 text-sm text-tinta-suave">{e.observaciones}</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
