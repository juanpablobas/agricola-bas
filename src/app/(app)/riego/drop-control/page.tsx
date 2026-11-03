import { exigirRol, puede } from "@/lib/auth";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { dcGet, hace, hayClaveDropControl } from "@/lib/dropcontrol";
import { vincularZona } from "./acciones";
import { GraficoMedida } from "./GraficoMedida";

export const metadata = { title: "Drop Control" };
export const dynamic = "force-dynamic";

const texto = (x: any) => String(x?.name ?? x?.nombre ?? x?.id ?? "—");
const cortar = (x: unknown, n = 1400) => { try { return JSON.stringify(x, null, 1).slice(0, n); } catch { return ""; } };

export default async function DropControl({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const q = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const edita = puede(perfil.rol, "administrador", "enc_administrativo", "enc_agricola");

  if (!hayClaveDropControl()) {
    return (
      <>
        <Encabezado titulo="Drop Control" subtitulo="Conexión con tus sensores y riego." volver={{ href: "/riego", texto: "Riego" }} />
        <Aviso>Todavía falta la clave. En Vercel, entra a Settings, Environment Variables, agrega <strong>DROPCONTROL_API_KEY</strong> con tu clave (marca Sensitive) y vuelve a desplegar. No pegues la clave en el chat.</Aviso>
      </>
    );
  }

  // Sectores de la app con sus cultivos
  const [{ data: sectores }, { data: cs }, { data: cuarteles }, { data: vinculos }] = await Promise.all([
    supabase.from("sector_riego").select("id, codigo, superficie_ha").order("codigo"),
    supabase.from("cuartel_sector").select("sector_id, cuartel_id").range(0, 1999),
    supabase.from("v_cuartel").select("id, codigo, especie, variedad, activo").range(0, 999),
    supabase.from("dropcontrol_zona").select("zona_id, sector_id").range(0, 999),
  ]);
  const cuartelPorId = new Map<string, any>((cuarteles ?? []).map((c: any) => [c.id as string, c] as [string, any]));
  const cultivosDe = (sectorId: string) => {
    const set = new Set<string>();
    for (const x of (cs ?? []) as any[]) {
      if (x.sector_id !== sectorId) continue;
      const c = cuartelPorId.get(x.cuartel_id);
      if (c?.activo) set.add(`${c.especie ?? "—"}${c.variedad ? ` ${c.variedad}` : ""} (${c.codigo})`);
    }
    return [...set].join(", ");
  };
  const sectorDeZona = new Map<string, string>((vinculos ?? []).map((v: any) => [v.zona_id as string, v.sector_id as string] as [string, string]));
  const sectorPorId = new Map<string, any>((sectores ?? []).map((s: any) => [s.id as string, s] as [string, any]));

  const campos = await dcGet<any[]>("/farms");
  const listaCampos: any[] = campos.ok && Array.isArray(campos.datos) ? campos.datos : [];

  const detalle = await Promise.all(
    listaCampos.slice(0, 5).map(async (f) => {
      const z = await dcGet<any[]>(`/farms/${f.id}/zones`);
      const zonas: any[] = z.ok && Array.isArray(z.datos) ? z.datos : [];
      const medidas = await Promise.all(
        zonas.slice(0, 30).map(async (zona) => {
          const m = await dcGet<any[]>(`/zones/${zona.id}/measures`);
          return { zona, ok: m.ok, error: m.error, medidas: m.ok && Array.isArray(m.datos) ? m.datos : [] };
        }),
      );
      return { campo: f, zonasOk: z.ok, zonasError: z.error, totalZonas: zonas.length, medidas };
    }),
  );
  const primera = detalle[0]?.medidas[0];

  return (
    <>
      <Encabezado titulo="Drop Control" subtitulo="Lo que dicen tus sensores, por zona de riego." volver={{ href: "/riego", texto: "Riego" }} />
      {q.ok && <div className="mb-3"><Aviso tipo="ok">Guardado.</Aviso></div>}
      {q.error && <div className="mb-3"><Aviso tipo="error">No se pudo guardar.</Aviso></div>}

      {!campos.ok ? (
        <Aviso tipo="error">No se pudo leer la cuenta (respuesta {campos.estado || "sin conexión"}): {campos.error}.</Aviso>
      ) : listaCampos.length === 0 ? (
        <Aviso>La conexión funciona, pero la cuenta no devolvió campos.</Aviso>
      ) : (
        <div className="mb-3"><Aviso>
          El punto verde significa que el sensor mandó datos en la última media hora; amarillo, en las últimas 3 horas; gris, hace más. Une cada zona con su sector para ver qué cultivos riega.
        </Aviso></div>
      )}

      <div className="flex flex-col gap-4">
        {detalle.map((d) => (
          <section key={String(d.campo.id)} className="flex flex-col gap-3">
            <h2 className="font-semibold">{texto(d.campo)} <span className="text-sm font-normal text-tinta-suave">· {d.totalZonas} zonas{d.totalZonas > 30 ? " (se muestran 30)" : ""}</span></h2>
            {!d.zonasOk && <p className="text-sm text-alerta">No se pudieron leer las zonas: {d.zonasError}</p>}
            <div className="grid gap-3 md:grid-cols-2">
              {d.medidas.map((m) => {
                const zid = String(m.zona.id);
                const sid = sectorDeZona.get(zid) ?? "";
                const sector = sid ? sectorPorId.get(sid) : null;
                return (
                  <article key={zid} className="tarjeta p-4">
                    <h3 className="font-medium">{texto(m.zona)}</h3>
                    {sector ? (
                      <p className="text-sm text-tinta-suave">Sector {sector.codigo}{sector.superficie_ha ? ` · ${sector.superficie_ha} ha` : ""} · {cultivosDe(sid) || "sin cultivos asignados"}</p>
                    ) : (
                      <p className="text-sm text-tinta-suave">Sin sector asignado</p>
                    )}
                    {edita && (
                      <form action={vincularZona} className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="zona" value={zid} />
                        <input type="hidden" name="nombre" value={texto(m.zona)} />
                        <select name="sector" defaultValue={sid} className="entrada w-full sm:w-64" aria-label={`Sector de ${texto(m.zona)}`}>
                          <option value="">— Sin sector —</option>
                          {(sectores ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.codigo} · {cultivosDe(s.id) || "sin cultivos"}</option>)}
                        </select>
                        <button className="boton-secundario">Guardar</button>
                      </form>
                    )}
                    <ul className="mt-3 flex flex-col gap-2">
                      {!m.ok && <li className="text-sm text-alerta">No se pudieron leer los sensores: {m.error}</li>}
                      {m.ok && m.medidas.length === 0 && <li className="text-sm text-tinta-suave">Sin sensores.</li>}
                      {m.medidas.slice(0, 12).map((x: any) => {
                        const h = hace(x.lastDataDate ?? x.lastDataTime ?? x.lastUpdate);
                        const punto = h.minutos === null ? "bg-linea" : h.minutos <= 30 ? "bg-verde" : h.minutos <= 180 ? "bg-ambar" : "bg-linea";
                        return (
                          <li key={String(x.id)} className="text-sm">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className={`inline-block size-2.5 self-center rounded-full ${punto}`} aria-hidden="true" />
                              <span className="font-medium">{texto(x)}</span>
                              <span>{x.lastData != null ? `${x.lastData}${x.unit ? ` ${x.unit}` : ""}` : "sin dato"}</span>
                              <span className="text-xs text-tinta-suave">{h.texto}</span>
                            </div>
                            <GraficoMedida id={String(x.id)} unidad={x.unit} />
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <details className="tarjeta mt-5 p-4">
        <summary className="cursor-pointer text-sm font-medium">Datos técnicos (para enviármelos si algo no calza)</summary>
        <p className="mt-2 text-xs text-tinta-suave">Muestra de lo que devuelve Drop Control. No incluye tu clave.</p>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-papel/60 p-3 text-xs">{`CAMPO:\n${cortar(listaCampos[0])}\n\nZONA:\n${cortar(primera?.zona)}\n\nSENSORES:\n${cortar(primera?.medidas?.slice(0, 3), 2200)}`}</pre>
      </details>
      <p className="mt-3 max-w-2xl text-xs text-tinta-suave">Esta pantalla solo lee: no cambia nada en Drop Control.</p>
    </>
  );
}
