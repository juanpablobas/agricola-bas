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
      .select("id, numero, nombre, origen, emisor, filtro, bomba, observaciones, caudal_diseno_m3h, presion_diseno_m, largo_goteo_m, largo_matriz_m, fuente_diseno, sector_riego(id, codigo, superficie_ha, lineas_por_hilera, caudal_emisor_lh, distancia_emisores_m, precipitacion_mmh, horas_turno, observaciones, caudal_diseno_m3h, presion_bomba_m, perdida_filtro_m, plantas, hileras, emisores, superficie_diseno_ha, bloque_riego(id, bloque, cultivo, plantas, marco_plantas, superficie_ha, hileras, emisores, presion_valvula_m, caudal_diseno_m3h))")
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
        acciones={puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola") ? <Link href="/riego/drop-control" className="boton-secundario">Drop Control</Link> : undefined}
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
              {e.caudal_diseno_m3h && (() => {
                const conDiseno = sectores.filter((x: any) => x.caudal_diseno_m3h && x.presion_bomba_m);
                const qMax = [...conDiseno].sort((a: any, b: any) => Number(b.caudal_diseno_m3h) - Number(a.caudal_diseno_m3h))[0];
                const hMax = [...conDiseno].sort((a: any, b: any) => Number(b.presion_bomba_m) - Number(a.presion_bomba_m) || Number(b.caudal_diseno_m3h) - Number(a.caudal_diseno_m3h))[0];
                const hMin = Math.min(...conDiseno.map((x: any) => Number(x.presion_bomba_m)));
                const kw = Math.max(...conDiseno.map((x: any) => (Number(x.caudal_diseno_m3h) * Number(x.presion_bomba_m)) / (367 * 0.65)));
                return (
                  <div className="border-b border-linea bg-verde-claro/50 px-5 py-3 text-sm">
                    <p className="font-medium text-verde-oscuro">Bomba que pide el diseño</p>
                    <ul className="mt-1 grid gap-x-6 gap-y-0.5 text-tinta sm:grid-cols-2">
                      <li>Mayor caudal: <b>{num(Number(qMax.caudal_diseno_m3h), 1)} m³/h</b> a {num(Number(qMax.presion_bomba_m), 0)} m (sector {qMax.codigo})</li>
                      <li>Mayor presión: <b>{num(Number(hMax.presion_bomba_m), 0)} m</b> con {num(Number(hMax.caudal_diseno_m3h), 1)} m³/h (sector {hMax.codigo})</li>
                      <li>La presión en bomba varía entre {num(hMin, 0)} y {num(Number(hMax.presion_bomba_m), 0)} m según el turno</li>
                      <li>Potencia aproximada del motor: <b>{num(kw, 1)} kW</b> (≈ {num(kw * 1.341, 0)} HP, con eficiencia de 65 %)</li>
                    </ul>
                    <p className="mt-1 text-xs text-tinta-suave">
                      Tubería de goteo {num(Number(e.largo_goteo_m), 0)} m · tubería PVC {num(Number(e.largo_matriz_m), 0)} m · {e.fuente_diseno}. Los valores son del diseño; la bomba real se define con el proveedor.
                    </p>
                  </div>
                );
              })()}
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Sector</th>
                      <th>Cuarteles</th>
                      <th className="text-right">Superficie</th>
                      <th className="text-right">Precipitación</th>
                      <th className="text-right">Turno</th>
                      <th className="text-right">Volumen turno</th><th className="text-right">Caudal diseño</th><th className="text-right">Presión bomba</th><th className="text-right">Plantas</th>
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
                          <td className="text-right tabular-nums">{s.caudal_diseno_m3h ? `${num(Number(s.caudal_diseno_m3h), 1)} m³/h` : "—"}</td>
                          <td className="text-right tabular-nums">{s.presion_bomba_m ? `${num(Number(s.presion_bomba_m), 0)} m` : "—"}</td>
                          <td className="text-right tabular-nums">{s.plantas ? num(s.plantas) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {sectores.some((x: any) => (x.bloque_riego ?? []).length > 0) && (
                <details className="border-t border-linea px-5 py-3 text-sm">
                  <summary className="cursor-pointer font-medium text-verde">Ver bloques de diseño (plantas, hileras, emisores)</summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="tabla">
                      <thead><tr><th>Sector</th><th>Bloque</th><th>Cultivo</th><th className="text-right">Plantas</th><th>Marco</th><th className="text-right">Superficie diseño</th><th className="text-right">Hileras</th><th className="text-right">Emisores</th><th className="text-right">Presión válvula</th><th className="text-right">Caudal</th></tr></thead>
                      <tbody>
                        {sectores.flatMap((x: any) => [...(x.bloque_riego ?? [])].sort((a: any, b: any) => a.bloque - b.bloque).map((b: any) => (
                          <tr key={b.id}>
                            <td className="font-medium">{x.codigo}</td><td>{b.bloque}</td><td>{b.cultivo}</td>
                            <td className="text-right tabular-nums">{num(b.plantas)}</td><td>{b.marco_plantas}</td>
                            <td className="text-right tabular-nums">{num(Number(b.superficie_ha), 3)} ha</td>
                            <td className="text-right tabular-nums">{num(b.hileras)}</td><td className="text-right tabular-nums">{num(b.emisores)}</td>
                            <td className="text-right tabular-nums">{num(Number(b.presion_valvula_m), 0)} m</td>
                            <td className="text-right tabular-nums">{num(Number(b.caudal_diseno_m3h), 1)} m³/h</td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-xs text-tinta-suave">La superficie de diseño sale de plantas × marco de plantación y puede diferir de la medida en el plano de sectorización.</p>
                </details>
              )}
              {e.observaciones && <p className="border-t border-linea px-5 py-3 text-sm text-tinta-suave">{e.observaciones}</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}
