import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { fecha, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { alertasDe, diasBuenosParaAplicar, nombreDiaClima, obtenerClima, ubicacionDelCampo, UMBRALES } from "@/lib/clima";
import { cargarSeguimiento } from "@/lib/seguimiento";
import { hayClaveIA } from "@/lib/recomendacion";
import { generarRecomendacionHoy, guardarUbicacion } from "./acciones";
import { BotonUbicacion } from "./BotonUbicacion";

export const metadata = { title: "Clima" };

export default async function Clima({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; ia?: string }> }) {
  const q = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario", "operario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");
  const verProgramas = perfil.rol !== "operario";
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

  const ubic = await ubicacionDelCampo(supabase);
  const clima = ubic ? await obtenerClima(ubic) : null;
  const alertas = clima ? alertasDe(clima.dias, hoy) : [];
  const buenos = clima ? diasBuenosParaAplicar(clima.dias, hoy) : [];

  let reco: { texto: string; modelo: string | null } | null = null;
  if (verProgramas) {
    const { data } = await supabase.from("recomendacion_diaria").select("texto, modelo").eq("fecha", hoy).maybeSingle();
    reco = data as any;
  }

  let porHacer = 0;
  if (verProgramas) {
    try {
      const { pendientes } = await cargarSeguimiento(supabase, hoy);
      porHacer = new Set(pendientes.filter((x) => ["atrasada", "este_mes", "reprogramada"].includes(x.situacion)).map((x) => x.app_id)).size;
    } catch { /* sin datos de programas */ }
  }

  return (
    <>
      <Encabezado titulo="Clima" subtitulo={ubic ? `Pronóstico para ${ubic.origen === "campo" ? "el fundo" : `la zona de ${ubic.nombre}`}.` : "Pronóstico del tiempo para el campo."} />
      {q.ok && <div className="mb-3"><Aviso tipo="ok">Ubicación guardada.</Aviso></div>}
      {q.error && <div className="mb-3"><Aviso tipo="error">Revisa la latitud y la longitud (por ejemplo -34,07 y -70,70).</Aviso></div>}

      {q.ia && <div className="mb-3"><Aviso tipo="error">No se pudo generar la recomendación: {q.ia}</Aviso></div>}
      {verProgramas && (
        <section className="tarjeta mb-4 p-4">
          <h2 className="mb-1 font-semibold">Recomendación del día <span className="pastilla ml-1 bg-verde-claro text-verde-oscuro">IA</span></h2>
          {reco ? (
            <p className="whitespace-pre-line text-sm">{reco.texto}</p>
          ) : !hayClaveIA() ? (
            <p className="text-sm text-tinta-suave">Todavía no está activada: falta la clave de la IA en Vercel (variable ANTHROPIC_API_KEY).</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-tinta-suave">Hoy todavía no se ha generado. Se genera sola cada mañana, o puedes pedirla ahora.</p>
              {edita && <form action={generarRecomendacionHoy}><button className="boton-secundario">Generar ahora</button></form>}
            </div>
          )}
          <p className="mt-2 text-xs text-tinta-suave">Una vez al día, con el pronóstico, tus aplicaciones por hacer y el plan de labores. Es una ayuda: la decisión sobre productos y dosis es del asesor, y siempre hay que mirar el campo.</p>
        </section>
      )}

      {!clima && <Aviso tipo="error">No se pudo obtener el pronóstico en este momento. Intenta de nuevo en unos minutos.</Aviso>}

      {clima && (
        <>
          {clima.actual && (
            <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Ahora</p><p className="mt-1 text-2xl font-semibold">{num(clima.actual.temp, 1)} °C</p></div>
              <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Viento</p><p className="mt-1 text-2xl font-semibold">{num(clima.actual.viento, 0)} km/h</p></div>
              <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Humedad</p><p className="mt-1 text-2xl font-semibold">{clima.actual.humedad != null ? `${clima.actual.humedad} %` : "—"}</p></div>
              <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Lluvia ahora</p><p className="mt-1 text-2xl font-semibold">{num(clima.actual.lluvia, 1)} mm</p></div>
            </section>
          )}

          <section className="tarjeta mb-4">
            <h2 className="p-4 pb-2 font-semibold">Alertas de los próximos días</h2>
            {alertas.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-tinta-suave">Sin alertas: no se esperan heladas, lluvia ni viento fuerte en los próximos 5 días.</p>
            ) : (
              alertas.map((a, i) => (
                <div key={i} className="border-t border-linea px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className={`pastilla ${a.nivel === "alto" ? "bg-alerta-claro text-alerta" : "bg-ambar-claro text-ambar"}`}>{a.nivel === "alto" ? "Alta" : "Media"}</span>
                    {a.titulo}
                  </p>
                  <p className="mt-0.5 text-sm text-tinta-suave">{a.detalle}</p>
                </div>
              ))
            )}
          </section>

          {verProgramas && (
            <section className="tarjeta mb-4 p-4">
              <h2 className="mb-1 font-semibold">Días buenos para aplicar</h2>
              {buenos.length === 0 ? (
                <p className="text-sm text-tinta-suave">En los próximos 5 días no hay un día claramente bueno (sin lluvia y con poco viento).</p>
              ) : (
                <p className="text-sm">{buenos.map((d) => `${nombreDiaClima(d.fecha)} ${d.fecha.slice(8, 10)}-${d.fecha.slice(5, 7)}`).join(" · ")}</p>
              )}
              <p className="mt-2 text-sm text-tinta-suave">
                {porHacer > 0 ? <>Tienes {porHacer} {porHacer === 1 ? "aplicación pendiente" : "aplicaciones pendientes"}. </> : "No tienes aplicaciones pendientes. "}
                <Link href="/programas" className="underline">Ver aplicaciones por hacer</Link>
              </p>
            </section>
          )}

          <section className="tarjeta mb-4 overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>Día</th><th className="text-right">Mínima</th><th className="text-right">Máxima</th><th className="text-right">Lluvia</th><th className="text-right">Viento</th></tr></thead>
              <tbody>
                {clima.dias.map((d) => (
                  <tr key={d.fecha} className={d.fecha < hoy ? "text-tinta-suave" : ""}>
                    <td className="whitespace-nowrap capitalize">{nombreDiaClima(d.fecha)} {fecha(d.fecha).slice(0, 5)}{d.fecha === hoy && <span className="pastilla ml-1.5 bg-verde-claro text-verde-oscuro">hoy</span>}{d.fecha < hoy && <span className="ml-1.5 text-xs">(pasado)</span>}</td>
                    <td className={`text-right ${d.fecha >= hoy && d.tmin <= UMBRALES.heladaMedia ? "font-semibold text-alerta" : ""}`}>{num(d.tmin, 1)} °C</td>
                    <td className="text-right">{num(d.tmax, 1)} °C</td>
                    <td className={`text-right ${d.lluvia >= UMBRALES.lluvia ? "font-semibold text-ambar" : ""}`}>{num(d.lluvia, 1)} mm{d.probLluvia != null && d.fecha >= hoy ? ` · ${d.probLluvia}%` : ""}</td>
                    <td className={`text-right ${d.viento >= UMBRALES.vientoMedio ? "font-semibold text-ambar" : ""}`}>{num(d.viento, 0)} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="tarjeta p-4">
        <h2 className="mb-1 font-semibold">Ubicación del campo</h2>
        <p className="mb-3 text-sm text-tinta-suave">
          {ubic?.origen === "campo" ? `Usando las coordenadas guardadas (${num(ubic.lat, 4)}; ${num(ubic.lng, 4)}).` : "Por ahora se usa la ubicación aproximada de la comuna. Para un pronóstico más exacto, guarda la ubicación del fundo."}
        </p>
        {edita ? (
          <form action={guardarUbicacion} className="flex flex-wrap items-end gap-3">
            <div><label htmlFor="lat" className="etiqueta-campo">Latitud</label><input id="lat" name="lat" defaultValue={ubic?.origen === "campo" ? ubic.lat : ""} inputMode="decimal" className="entrada w-36" placeholder="-34,07" /></div>
            <div><label htmlFor="lng" className="etiqueta-campo">Longitud</label><input id="lng" name="lng" defaultValue={ubic?.origen === "campo" ? ubic.lng : ""} inputMode="decimal" className="entrada w-36" placeholder="-70,70" /></div>
            <button className="boton">Guardar</button>
            <BotonUbicacion />
          </form>
        ) : null}
      </section>
      <p className="mt-3 max-w-2xl text-xs text-tinta-suave">
        Estación del campo: <a href="https://alertas.agromet.cl/monitoreo/61" target="_blank" rel="noopener noreferrer" className="underline">ver Codegua Norte en Agromet</a> (datos medidos, solo para consultar; la app todavía no los lee).<br />
        Datos de Open-Meteo, que se actualizan cada media hora. Las alertas usan referencias generales (helada desde 2 °C de mínima, lluvia desde 1 mm, viento desde 15 km/h) y no reemplazan el criterio del asesor.
      </p>
    </>
  );
}
