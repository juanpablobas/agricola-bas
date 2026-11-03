import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { NOMBRE_MES, MESES_TEMPORADA } from "@/lib/programas";
import { cargarSeguimiento, type Pendiente } from "@/lib/seguimiento";
import { fecha } from "@/lib/formato";
import { enlaceWhatsapp } from "@/lib/whatsapp";
import { posponerAplicacion, reactivarAplicacion } from "./acciones";

export const metadata = { title: "Programas" };

export default async function Programas({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const aplica = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");

  const [{ data: programas }, { data: apps }, { data: pv }, { data: cuarteles }, { data: lineas }] = await Promise.all([
    supabase.from("programa").select("id, nombre, asesor, archivo, temporada(nombre)").eq("activo", true).order("nombre"),
    supabase.from("programa_aplicacion").select("programa_id, mes").range(0, 999),
    supabase.from("programa_variedad").select("programa_id, variedad_id, variedad(nombre)").range(0, 999),
    supabase.from("v_cuartel").select("variedad_id, superficie_ha, activo").eq("activo", true).range(0, 999),
    supabase.from("programa_linea").select("producto_id").range(0, 1999),
  ]);

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const { pendientes } = await cargarSeguimiento(supabase, hoy);
  // Se agrupan por aplicación: lo normal es que lluvia o viento afecten a todas las variedades de esa aplicación
  const porApp = new Map<string, Pendiente[]>();
  for (const x of pendientes) if (["atrasada", "este_mes", "reprogramada"].includes(x.situacion)) porApp.set(x.app_id, [...(porApp.get(x.app_id) ?? []), x]);
  const orden = { atrasada: 0, reprogramada: 1, este_mes: 2 } as Record<string, number>;
  const porHacer = [...porApp.values()].sort((a, b) => orden[a[0].situacion] - orden[b[0].situacion] || MESES_TEMPORADA.indexOf(a[0].mes ?? 0) - MESES_TEMPORADA.indexOf(b[0].mes ?? 0) || a[0].orden - b[0].orden);
  const apartadas = pendientes.filter((x) => x.situacion === "omitida");
  const puedeGestionar = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");

  const haPorVariedad = new Map<string, number>();
  for (const c of cuarteles ?? []) if (c.variedad_id) haPorVariedad.set(c.variedad_id, (haPorVariedad.get(c.variedad_id) ?? 0) + Number(c.superficie_ha ?? 0));
  const sinVincular = (lineas ?? []).filter((l: any) => !l.producto_id).length;

  const botones = (
    <>
      <Link href="/programas/compra" className="boton"><Icono nombre="inventario" className="size-4" />Qué comprar</Link>
      {aplica && <Link href="/programas/aplicar" className="boton-secundario"><Icono nombre="ok" className="size-4" />Registrar aplicación</Link>}
      <Link href="/programas/opciones" className="boton-secundario"><Icono nombre="editar" className="size-4" />Opciones y precios</Link>
      <Link href="/programas/mojamiento" className="boton-secundario"><Icono nombre="riego" className="size-4" />Mojamiento</Link>
      <Link href="/programas/historial" className="boton-secundario"><Icono nombre="historia" className="size-4" />Historial</Link>
    </>
  );

  return (
    <>
      <Encabezado titulo="Programas" subtitulo="Programas fitosanitarios y de nutrición de los asesores, por especie." acciones={botones} />

      {q.ok === "postergada" && <div className="mb-3"><Aviso tipo="ok">Aplicación postergada. Volverá a aparecer como atrasada si pasa la nueva fecha sin registrarla.</Aviso></div>}
      {q.ok === "omitida" && <div className="mb-3"><Aviso tipo="ok">Aplicación marcada como “no se hará”. Ya no cuenta en “Qué comprar”.</Aviso></div>}
      {q.ok === "reactivada" && <div className="mb-3"><Aviso tipo="ok">La aplicación volvió a pendiente.</Aviso></div>}
      {q.error === "fecha" && <div className="mb-3"><Aviso tipo="error">Indica una nueva fecha que sea hoy o una futura.</Aviso></div>}
      {q.error === "1" && <div className="mb-3"><Aviso tipo="error">No se pudo guardar. Intenta de nuevo.</Aviso></div>}

      {porHacer.length > 0 && (
        <section className="tarjeta mb-5 border-ambar/40">
          <div className="p-4 pb-2">
            <h2 className="font-semibold">Aplicaciones por hacer</h2>
            <p className="text-sm text-tinta-suave">Lo que toca este mes, lo atrasado y lo postergado. Si no se pudo aplicar (por ejemplo, por lluvia), posterga la aplicación o márcala como que no se hará.</p>
          </div>
          {porHacer.map((g) => {
            const x = g[0];
            const etiqueta = x.situacion === "atrasada" ? { t: "Atrasada", c: "bg-alerta-claro text-alerta" } : x.situacion === "reprogramada" ? { t: `Para el ${fecha(x.nueva_fecha)}`, c: "bg-verde-claro text-verde-oscuro" } : { t: "Toca este mes", c: "bg-ambar-claro text-ambar" };
            return (
              <div key={x.app_id} className="border-t border-linea px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`pastilla ${etiqueta.c}`}>{etiqueta.t}</span>
                  <span className="font-medium">{x.orden}. {x.titulo}</span>
                  <span className="text-sm capitalize text-tinta-suave">{x.mes ? NOMBRE_MES[x.mes] : ""} · {x.programa}</span>
                </div>
                <p className="mt-1 text-sm text-tinta-suave">Falta en: {g.map((v) => v.variedad).join(", ")}{x.motivo ? ` · se postergó por ${x.motivo.toLowerCase()}` : ""}</p>
                {puedeGestionar && (
                  <div className="mt-2 flex flex-wrap items-start gap-4 text-sm">
                    <Link href={`/programas/aplicar?v=${g[0].variedad_id}&a=${x.app_id}`} className="font-medium text-verde hover:underline">Registrar</Link>
                    <a href={enlaceWhatsapp(null, `Recordatorio Agrícola BAS: ${x.situacion === "atrasada" ? "está atrasada" : "toca"} la aplicación ${x.orden}. ${x.titulo} (${x.programa}) en ${g.map((v) => v.variedad).join(", ")}.${x.nueva_fecha ? ` Quedó para el ${fecha(x.nueva_fecha)}.` : ""} Avísame cuando se haga para registrarla.`)} target="_blank" rel="noopener noreferrer" className="hover:underline">Avisar por WhatsApp</a>
                    <details>
                      <summary className="cursor-pointer hover:underline">No se pudo / postergar</summary>
                      <form action={posponerAplicacion} className="mt-2 flex max-w-lg flex-col gap-3 rounded-lg border border-linea bg-papel/50 p-3">
                        <input type="hidden" name="app" value={x.app_id} />
                        {g.map((v) => <input key={v.variedad_id} type="hidden" name="variedad" value={v.variedad_id} />)}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="etiqueta-campo" htmlFor={`m-${x.app_id}`}>Motivo</label>
                            <select id={`m-${x.app_id}`} name="motivo" defaultValue="Lluvia" className="entrada">
                              {["Lluvia", "Viento", "Falta de producto", "Falta de personal", "Otro"].map((m) => <option key={m}>{m}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="etiqueta-campo" htmlFor={`f-${x.app_id}`}>Nueva fecha</label>
                            <input id={`f-${x.app_id}`} name="nueva_fecha" type="date" min={hoy} defaultValue={new Date(Date.now() + 86400000).toLocaleDateString("en-CA", { timeZone: "America/Santiago" })} className="entrada" />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button name="estado" value="postergada" className="boton">Postergar a esa fecha</button>
                          <button name="estado" value="omitida" className="boton-secundario" formNoValidate>Ya no se hará</button>
                        </div>
                      </form>
                    </details>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {(programas ?? []).length === 0 && <Aviso>Todavía no hay programas cargados.</Aviso>}

      <section className="grid gap-4 md:grid-cols-2">
        {(programas ?? []).map((p: any) => {
          const misApps = (apps ?? []).filter((a: any) => a.programa_id === p.id);
          const meses = misApps.map((a: any) => a.mes).filter(Boolean) as number[];
          const ordenados = [...meses].sort((x, y) => MESES_TEMPORADA.indexOf(x) - MESES_TEMPORADA.indexOf(y));
          const variedades = (pv ?? []).filter((v: any) => v.programa_id === p.id) as any[];
          const haTotal = variedades.reduce((s, v) => s + (haPorVariedad.get(v.variedad_id) ?? 0), 0);
          return (
            <Link key={p.id} href={`/programas/${p.id}`} className="tarjeta block p-5 transition hover:border-verde/50">
              <h2 className="font-semibold">{p.nombre}</h2>
              <p className="mt-0.5 text-sm text-tinta-suave">
                {p.asesor ? `Asesor: ${p.asesor}` : "Asesor sin indicar"}
                {p.temporada?.nombre ? ` · Temporada ${p.temporada.nombre}` : ""}
              </p>
              <p className="mt-3 text-sm">
                <strong>{misApps.length}</strong> aplicaciones
                {meses.length > 0 && <> · de {NOMBRE_MES[ordenados[0]]} a {NOMBRE_MES[ordenados[ordenados.length - 1]]}</>}
              </p>
              <p className="mt-1 text-sm text-tinta-suave">
                {variedades.map((v) => v.variedad?.nombre).join(", ")} · {num(haTotal, 2)} ha
              </p>
            </Link>
          );
        })}
      </section>

      {apartadas.length > 0 && (
        <details className="tarjeta mt-4">
          <summary className="cursor-pointer p-4 text-sm font-medium">Aplicaciones que ya no se harán ({apartadas.length})</summary>
          {apartadas.map((x) => (
            <div key={`${x.app_id}|${x.variedad_id}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-linea px-4 py-2.5 text-sm">
              <span>{x.orden}. {x.titulo} · {x.variedad}{x.motivo ? ` · ${x.motivo}` : ""}</span>
              {puedeGestionar && (
                <form action={reactivarAplicacion}><input type="hidden" name="app" value={x.app_id} /><input type="hidden" name="variedad" value={x.variedad_id} /><button className="text-verde hover:underline">Volver a pendiente</button></form>
              )}
            </div>
          ))}
        </details>
      )}

      {sinVincular > 0 && (
        <div className="mt-4">
          <Aviso>
            Hay {sinVincular} líneas de los programas cuyo producto no está unido a la bodega, así que no se les puede calcular stock ni descontar.{" "}
            {puede(perfil.rol, "administrador", "enc_administrativo") ? <Link href="/programas/vincular" className="font-medium underline">Unirlos ahora</Link> : "Pide al administrador de la app que los una."}
          </Aviso>
        </div>
      )}
    </>
  );
}
