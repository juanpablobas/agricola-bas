import Link from "next/link";
import { obtenerSesion, puede } from "@/lib/auth";
import { ha, num, pct, fecha } from "@/lib/formato";
import { colorEspecie, etiquetaEstado } from "@/lib/etiquetas";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { cargarSeguimiento } from "@/lib/seguimiento";
import { hoyChile, lunesDe, sumaDias } from "@/lib/semana";
import { alertasDe, obtenerClima, ubicacionDelCampo, type Alerta, type Dia } from "@/lib/clima";
import { leerTodo } from "@/lib/programas";
import {
  AccesosRapidos, Atencion, TarjetaAplicaciones, TarjetaClima, TarjetaCosecha, TarjetaFinanzas, TarjetaLabores, TarjetaRecomendacion,
} from "./TarjetasInicio";

export const metadata = { title: "Inicio" };

type FilaCuartel = {
  id: string;
  codigo: string;
  superficie_ha: number;
  estado_productivo: string;
  especie: string | null;
  grupo: string | null;
  variedad: string | null;
  anio_plantacion: number | null;
  portainjerto: string | null;
  plantas: number | null;
  plantas_teoricas: number | null;
  equipo: number | null;
};

function agrupar<T>(filas: T[], clave: (f: T) => string) {
  const m = new Map<string, T[]>();
  for (const f of filas) {
    const k = clave(f);
    m.set(k, [...(m.get(k) ?? []), f]);
  }
  return m;
}

const suma = (fs: FilaCuartel[]) => fs.reduce((s, f) => s + Number(f.superficie_ha), 0);
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLarga = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z");
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
};
/** Cada consulta del inicio es opcional: si una falla, el resto de la página se muestra igual */
async function intentar<T>(f: () => Promise<T>, siFalla: T): Promise<T> {
  try {
    return await f();
  } catch {
    return siFalla;
  }
}

export default async function Inicio({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, perfil } = await obtenerSesion();
  const rol = perfil.rol;
  const gestiona = puede(rol, "administrador", "enc_administrativo", "enc_agricola");
  const veProgramas = puede(rol, "administrador", "enc_administrativo", "enc_agricola", "propietario");
  const veFinanzas = puede(rol, "administrador", "enc_administrativo", "propietario");

  const hoy = hoyChile();
  const manana = sumaDias(hoy, 1);
  const semana = lunesDe(hoy);

  const [{ data: cuarteles }, { data: campo }, { count: nSectores }, { data: temporada }] = await Promise.all([
    supabase
      .from("v_cuartel")
      .select("id, codigo, superficie_ha, estado_productivo, especie, grupo, variedad, anio_plantacion, portainjerto, plantas, plantas_teoricas, equipo")
      .eq("activo", true)
      .order("codigo")
      .returns<FilaCuartel[]>(),
    supabase.from("campo").select("nombre, superficie_total_ha").maybeSingle(),
    supabase.from("sector_riego").select("id", { count: "exact", head: true }),
    supabase.from("temporada").select("id, nombre, inicio, termino").lte("inicio", hoy).gte("termino", hoy).maybeSingle(),
  ]);

  // Lo del día: clima, aplicaciones, labores, gastos, cosecha y la recomendación (todo en paralelo)
  const [clima, seguimiento, labores, meses, cosecha, reco] = await Promise.all([
    intentar(async () => {
      const ub = await ubicacionDelCampo(supabase);
      return ub ? await obtenerClima(ub) : null;
    }, null as { actual: { temp: number } | null; dias: Dia[] } | null),
    veProgramas ? intentar(() => cargarSeguimiento(supabase, hoy), null) : Promise.resolve(null),
    veProgramas
      ? intentar(async () => {
          const [{ data: plan }, { count }, { count: porConfirmar }] = await Promise.all([
            supabase.from("labor_plan").select("estado").eq("semana", semana),
            supabase.from("labor_registro").select("id", { count: "exact", head: true }).eq("estado", "realizado").gte("fecha", semana).lte("fecha", sumaDias(semana, 6)),
            supabase.from("labor_registro").select("id", { count: "exact", head: true }).eq("estado", "programado").lte("fecha", hoy),
          ]);
          const p = (plan ?? []) as { estado: string }[];
          return { planificadas: p.filter((x) => x.estado === "pendiente").length, hechas: p.filter((x) => x.estado === "hecha").length, registros: count ?? 0, porConfirmar: porConfirmar ?? 0 };
        }, null)
      : Promise.resolve(null),
    veFinanzas && temporada
      ? intentar(async () => {
          const filas = await leerTodo<any>((d, h) => supabase.from("v_presupuesto_real").select("mes, presupuesto, real").eq("temporada_id", temporada.id).range(d, h));
          const m = new Map<string, { mes: string; presupuesto: number; real: number }>();
          for (const f of filas) {
            const k = String(f.mes).slice(0, 10);
            const g = m.get(k) ?? { mes: k, presupuesto: 0, real: 0 };
            g.presupuesto += Number(f.presupuesto ?? 0);
            g.real += Number(f.real ?? 0);
            m.set(k, g);
          }
          return [...m.values()].sort((a, b) => a.mes.localeCompare(b.mes));
        }, null)
      : Promise.resolve(null),
    veProgramas && temporada
      ? intentar(async () => {
          const filas = await leerTodo<any>((d, h) => supabase.from("cosecha").select("kilos, cantidad, unidad").gte("fecha", temporada.inicio).lte("fecha", temporada.termino).range(d, h));
          return {
            kilos: filas.reduce((s, f) => s + Number(f.kilos ?? 0), 0),
            bins: filas.reduce((s, f) => s + (f.unidad === "bins" ? Number(f.cantidad ?? 0) : 0), 0),
            registros: filas.length,
          };
        }, null)
      : Promise.resolve(null),
    veProgramas
      ? intentar(async () => (await supabase.from("recomendacion_diaria").select("texto").eq("fecha", hoy).maybeSingle()).data?.texto as string | undefined, undefined)
      : Promise.resolve(undefined),
  ]);

  const alertasClima: Alerta[] = clima ? alertasDe(clima.dias, hoy, 2).filter((a) => a.fecha <= manana) : [];
  const pend = seguimiento?.pendientes ?? [];
  const atrasadas = new Set(pend.filter((x) => x.situacion === "atrasada").map((x) => x.app_id)).size;
  const esteMes = new Set(pend.filter((x) => x.situacion === "este_mes" || x.situacion === "reprogramada").map((x) => x.app_id)).size;

  // Lista corta de aplicaciones por hacer: una línea por aplicación, con sus variedades
  const porApp = new Map<string, { texto: string; variedades: string[]; atrasada: boolean; programa: string }>();
  for (const x of pend.filter((p) => ["atrasada", "este_mes", "reprogramada"].includes(p.situacion))) {
    const g = porApp.get(x.app_id) ?? { texto: x.titulo || `Aplicación ${x.orden}`, variedades: [], atrasada: false, programa: x.programa };
    g.variedades.push(x.variedad);
    g.atrasada ||= x.situacion === "atrasada";
    porApp.set(x.app_id, g);
  }
  const listaApps = [...porApp.values()]
    .sort((a, b) => Number(b.atrasada) - Number(a.atrasada))
    .slice(0, 3)
    .map((a) => ({ texto: a.texto, detalle: `${a.programa} · ${a.variedades.join(", ")}`, atrasada: a.atrasada }));

  const atencion: { texto: React.ReactNode; href?: string; nivel: "alto" | "medio" }[] = [
    ...alertasClima.map((a) => ({ texto: <><strong>{a.fecha === hoy ? "Hoy" : "Mañana"}:</strong> {a.titulo}</>, href: "/clima", nivel: a.nivel })),
    ...(labores && labores.porConfirmar > 0 ? [{ texto: <>Hay <strong>{labores.porConfirmar}</strong> {labores.porConfirmar === 1 ? "trabajo programado" : "trabajos programados"} cuya fecha ya pasó: confirma si se hizo.</>, href: "/labores", nivel: "medio" as const }] : []),
    ...(atrasadas > 0 ? [{ texto: <>Hay <strong>{atrasadas}</strong> {atrasadas === 1 ? "aplicación atrasada" : "aplicaciones atrasadas"}: regístrala o posponla.</>, href: "/programas", nivel: "alto" as const }] : []),
  ];

  const accesos = gestiona
    ? [
        { href: "/labores/registrar", texto: "Registrar labor", icono: "labores" },
        { href: "/programas/aplicar", texto: "Registrar aplicación", icono: "programas" },
        { href: "/inventario/salida", texto: "Sacar de bodega", icono: "inventario" },
        { href: "/cosecha/registrar", texto: "Registrar cosecha", icono: "cosecha" },
      ]
    : [];

  // Resumen del campo (catastro)
  const filas = (cuarteles ?? []) as FilaCuartel[];
  const total = suma(filas);
  const noPlantado = (f: FilaCuartel) => f.estado_productivo === "sin_plantar" || f.estado_productivo === "eliminado";
  const plantados = filas.filter((f) => !noPlantado(f));
  const porPlantar = filas.filter(noPlantado);
  const totalPlantado = suma(plantados);
  const plantas = filas.reduce((s, f) => s + (f.plantas ?? f.plantas_teoricas ?? 0), 0);
  const porGrupo = [...agrupar(plantados, (f) => f.grupo ?? "Sin especie")].map(([g, fs]) => ({ g, ha: suma(fs), n: fs.length }));
  const porEspecie = [...agrupar(filas, (f) => f.especie ?? "Sin especie")]
    .map(([especie, fs]) => ({ especie, ha: suma(fs), n: fs.length }))
    .sort((a, b) => b.ha - a.ha);
  const porVariedad = [...agrupar(filas, (f) => `${f.especie ?? "Sin especie"}|${f.variedad ?? "Sin variedad"}`)]
    .map(([k, fs]) => {
      const [especie, variedad] = k.split("|");
      return { especie, variedad, ha: suma(fs), cuarteles: fs.map((f) => f.codigo) };
    })
    .sort((a, b) => b.ha - a.ha);
  const porEquipo = [...agrupar(filas, (f) => String(f.equipo ?? "—"))]
    .map(([equipo, fs]) => ({ equipo, ha: suma(fs), especies: [...new Set(fs.map((f) => f.especie))].join(", ") }))
    .sort((a, b) => a.equipo.localeCompare(b.equipo));
  const porEstado = [...agrupar(filas, (f) => f.estado_productivo)].map(([e, fs]) => ({ e, ha: suma(fs) }));
  const fichasIncompletas = plantados.filter((f) => !f.variedad || !f.anio_plantacion || !f.portainjerto || f.plantas === null).length;

  return (
    <>
      <header className="mb-5">
        <p className="text-sm text-tinta-suave first-letter:uppercase">{fechaLarga(hoy)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Hola{perfil.nombre ? `, ${perfil.nombre.split(" ")[0]}` : ""}</h1>
        <p className="text-sm text-tinta-suave">
          {campo?.nombre ?? "Fundo La Morera"} · {temporada ? `Temporada ${temporada.nombre}` : "Sin temporada vigente: créala en Configuración"}
        </p>
      </header>

      {error === "permiso" && (
        <div className="mb-4">
          <Aviso tipo="error">No tienes permiso para entrar a esa sección.</Aviso>
        </div>
      )}

      <Atencion items={atencion} />
      <AccesosRapidos accesos={accesos} />

      <div className="aparecer-escalonado grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TarjetaClima temp={clima?.actual?.temp ?? null} dias={clima?.dias ?? []} hoy={hoy} alertas={alertasClima} />
        {seguimiento && <TarjetaAplicaciones atrasadas={atrasadas} esteMes={esteMes} lista={listaApps} />}
        {labores && <TarjetaLabores {...labores} puedePlanificar={gestiona} semana={semana} />}
        {meses && temporada && <TarjetaFinanzas meses={meses} temporada={temporada.nombre} />}
        {reco && <TarjetaRecomendacion texto={reco} />}
        {cosecha && cosecha.registros > 0 && <TarjetaCosecha {...cosecha} />}
      </div>

      {/* El campo en números (catastro) */}
      <section className="tarjeta mt-6 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-semibold">El campo</h2>
          <Link href="/cuarteles" className="inline-flex min-h-9 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-verde hover:bg-verde-claro">
            Cuarteles<Icono nombre="volver" className="size-4 rotate-180" />
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-tinta-suave">Plantado</dt>
            <dd className="text-xl font-semibold tabular-nums">{ha(totalPlantado)}</dd>
            {porPlantar.length > 0 && <dd className="text-xs text-tinta-suave">{ha(suma(porPlantar))} por plantar</dd>}
          </div>
          {porGrupo.map((g) => (
            <div key={g.g}>
              <dt className="text-xs text-tinta-suave">{g.g === "Nogal" ? "Nogales" : g.g === "Carozo" ? "Carozos" : g.g}</dt>
              <dd className="text-xl font-semibold tabular-nums">{ha(g.ha)}</dd>
              <dd className="text-xs text-tinta-suave">{g.n} cuarteles</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs text-tinta-suave">Cuarteles · sectores</dt>
            <dd className="text-xl font-semibold tabular-nums">{filas.length} · {nSectores ?? 0}</dd>
            <dd className="text-xs text-tinta-suave">{num(plantas)} plantas</dd>
          </div>
        </dl>

        <div className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {porEspecie.map((e) => (
            <div key={e.especie}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: colorEspecie(e.especie) }} />
                  {e.especie}
                </span>
                <span className="tabular-nums text-tinta-suave">{ha(e.ha)} · {pct((e.ha / (total || 1)) * 100)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-papel">
                <div className="h-full rounded-full" style={{ width: `${(e.ha / (total || 1)) * 100}%`, background: colorEspecie(e.especie) }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {porEstado.map((e) => (
            <span key={e.e} className="pastilla bg-papel text-tinta">{etiquetaEstado(e.e)}: {ha(e.ha)}</span>
          ))}
        </div>

        <details className="group mt-4 border-t border-linea pt-3">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 text-sm font-medium text-verde">
            <Icono nombre="volver" className="size-4 -rotate-90 transition group-open:rotate-90" />
            Ver superficie por variedad y por equipo de riego
          </summary>
          <div className="mt-3 grid gap-5 lg:grid-cols-5">
            <div className="overflow-x-auto lg:col-span-3">
              <table className="tabla">
                <thead><tr><th>Variedad</th><th className="text-right">Superficie</th><th className="hidden sm:table-cell">Cuarteles</th></tr></thead>
                <tbody>
                  {porVariedad.map((v) => (
                    <tr key={`${v.especie}-${v.variedad}`}>
                      <td>
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorEspecie(v.especie) }} />
                          <span><span className={v.variedad === "Sin variedad" ? "text-ambar" : "font-medium"}>{v.variedad}</span><span className="text-tinta-suave"> · {v.especie}</span></span>
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{ha(v.ha)}</td>
                      <td className="hidden text-tinta-suave sm:table-cell">{v.cuarteles.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto lg:col-span-2">
              <table className="tabla">
                <thead><tr><th>Equipo</th><th>Especies</th><th className="text-right">Superficie</th></tr></thead>
                <tbody>
                  {porEquipo.map((e) => (
                    <tr key={e.equipo}>
                      <td className="font-medium">Equipo {e.equipo}</td>
                      <td className="text-tinta-suave">{e.especies}</td>
                      <td className="text-right tabular-nums">{ha(e.ha)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        {gestiona && fichasIncompletas > 0 && (
          <p className="mt-3 text-xs text-tinta-suave">
            {fichasIncompletas} {fichasIncompletas === 1 ? "cuartel tiene" : "cuarteles tienen"} la ficha incompleta (variedad, año, portainjerto o conteo de plantas).{" "}
            <Link href="/cuarteles" className="font-medium text-verde underline">Completar</Link>
          </p>
        )}
      </section>

      {temporada && <p className="mt-4 text-xs text-tinta-suave">Temporada {temporada.nombre}: {fecha(temporada.inicio)} al {fecha(temporada.termino)}.</p>}
    </>
  );
}
