import Link from "next/link";
import { exigirRol } from "@/lib/auth";
import { fecha, num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { NOMBRE_MES, MESES_TEMPORADA, dosisPorHa, esPrincipal, normalizarLinea, type Aplicacion } from "@/lib/programas";
import { MES_INICIO_SEGUIMIENTO } from "@/lib/seguimiento";
import { FormularioAplicacion, type LineaForm } from "./FormularioAplicacion";

export const metadata = { title: "Registrar aplicación" };

export default async function Aplicar({ searchParams }: { searchParams: Promise<{ v?: string; a?: string; programa?: string }> }) {
  const p = await searchParams;
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola");
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const mesActual = Number(hoy.slice(5, 7));

  const [{ data: pv }, { data: cuarteles }] = await Promise.all([
    supabase.from("programa_variedad").select("programa_id, variedad_id, variedad(nombre, especie(nombre)), programa(nombre, activo)").range(0, 999),
    supabase.from("v_cuartel").select("variedad_id, superficie_ha").eq("activo", true).range(0, 999),
  ]);
  const haPor = new Map<string, number>();
  for (const c of cuarteles ?? []) if (c.variedad_id) haPor.set(c.variedad_id, (haPor.get(c.variedad_id) ?? 0) + Number(c.superficie_ha ?? 0));
  const filas = ((pv ?? []) as any[]).filter((r) => r.programa?.activo && (!p.programa || r.programa_id === p.programa));

  // Paso 1: elegir variedad
  if (!p.v) {
    const unicas = new Map<string, { id: string; nombre: string; especie: string }>();
    for (const r of filas) unicas.set(r.variedad_id, { id: r.variedad_id, nombre: r.variedad?.nombre ?? "", especie: r.variedad?.especie?.nombre ?? "" });
    const lista = [...unicas.values()].sort((a, b) => a.especie.localeCompare(b.especie) || a.nombre.localeCompare(b.nombre));
    return (
      <>
        <Encabezado titulo="Registrar aplicación" subtitulo="Paso 1 de 3 · ¿En qué variedad aplicaste?" volver={{ href: "/programas", texto: "Programas" }} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((v) => (
            <Link key={v.id} href={`/programas/aplicar?v=${v.id}${p.programa ? `&programa=${p.programa}` : ""}`} className="tarjeta block p-4 transition hover:border-verde/50">
              <p className="font-semibold">{v.nombre}</p>
              <p className="text-sm text-tinta-suave">{v.especie} · {num(haPor.get(v.id) ?? 0, 2)} ha</p>
            </Link>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-xs text-tinta-suave">Se registra por variedad porque así lo hacen el encargado y la administración. Si en un día aplicas varias variedades, repite el registro para cada una.</p>
      </>
    );
  }

  const variedadId = p.v;
  const mia = filas.filter((r) => r.variedad_id === variedadId);
  const variedad = mia[0]?.variedad;
  if (!variedad) return <Aviso tipo="error">No encontré esa variedad en los programas.</Aviso>;
  const progIds = mia.map((r) => r.programa_id);

  const [{ data: appsRaw }, { data: hechas }, { data: reales }, { data: omit }] = await Promise.all([
    supabase.from("programa_aplicacion").select("id, programa_id, orden, titulo, estado_fenologico, fecha_estimada, mes").in("programa_id", progIds).order("orden"),
    supabase.from("aplicacion_realizada").select("programa_aplicacion_id, fecha").eq("variedad_id", variedadId),
    supabase.from("mojamiento_real").select("mes, litros_ha").eq("variedad_id", variedadId),
    supabase.from("aplicacion_estado").select("programa_aplicacion_id").eq("variedad_id", variedadId).eq("estado", "omitida"),
  ]);
  const omitidas = new Set((omit ?? []).map((o: any) => o.programa_aplicacion_id as string));
  const apps = (appsRaw ?? []) as Aplicacion[];
  const hecha = new Map<string, string>((hechas ?? []).map((h: any) => [h.programa_aplicacion_id as string, h.fecha as string]));

  // Paso 2: elegir aplicación
  if (!p.a) {
    const idx = (m: number | null) => (m ? MESES_TEMPORADA.indexOf(m) : 99);
    const sugerida = apps.filter((a) => !hecha.has(a.id) && !omitidas.has(a.id) && idx(a.mes) >= MESES_TEMPORADA.indexOf(Math.max(1, MES_INICIO_SEGUIMIENTO))).sort((x, y) => idx(x.mes) - idx(y.mes) || x.orden - y.orden)[0];
    return (
      <>
        <Encabezado titulo="Registrar aplicación" subtitulo={`Paso 2 de 3 · ${variedad.nombre}: ¿cuál aplicación hiciste?`} volver={{ href: `/programas/aplicar${p.programa ? `?programa=${p.programa}` : ""}`, texto: "Cambiar variedad" }} />
        <section className="tarjeta divide-y divide-linea">
          {apps.map((a) => (
            <Link key={a.id} href={`/programas/aplicar?v=${variedadId}&a=${a.id}`} className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-3 hover:bg-verde-claro/50 ${sugerida?.id === a.id ? "bg-ambar-claro/40" : ""}`}>
              <span className="grid size-7 place-items-center rounded-full bg-verde-claro text-sm font-semibold text-verde-oscuro">{a.orden}</span>
              <span className="font-medium">{a.titulo}</span>
              <span className="text-sm capitalize text-tinta-suave">{a.mes ? NOMBRE_MES[a.mes] : ""}</span>
              {sugerida?.id === a.id && <span className="pastilla bg-ambar-claro text-ambar">la que toca</span>}
              {hecha.has(a.id) && <span className="ml-auto text-sm text-verde">Registrada el {fecha(hecha.get(a.id))}</span>}
            </Link>
          ))}
        </section>
      </>
    );
  }

  // Paso 3: confirmar productos y cantidades
  const app = apps.find((a) => a.id === p.a);
  if (!app) return <Aviso tipo="error">No encontré esa aplicación.</Aviso>;
  const { data: lraw } = await supabase.from("programa_linea").select("*").eq("aplicacion_id", app.id).order("orden");
  const lineas = (lraw ?? []).map(normalizarLinea);

  const ids = [...new Set(lineas.map((l) => l.producto_id).filter(Boolean))] as string[];
  const { data: stocks } = ids.length ? await supabase.from("v_stock").select("producto_id, stock, unidad").in("producto_id", ids) : { data: [] as any[] };
  const stockDe = new Map<string, any>((stocks ?? []).map((s: any) => [s.producto_id as string, s]));

  const realMes = (reales ?? []).find((r: any) => r.mes === app.mes)?.litros_ha;
  const mojamsPrograma = lineas.filter((l) => esPrincipal(l) && (l.mojam_programa ?? 0) >= 100).map((l) => l.mojam_programa as number);
  const litrosInicial = realMes ? Number(realMes) : mojamsPrograma.length ? mojamsPrograma.sort((a, b) => a - b)[Math.floor(mojamsPrograma.length / 2)] : 1000;
  const haInicial = Math.round((haPor.get(variedadId) ?? 0) * 100) / 100;

  const lf: LineaForm[] = lineas.map((l) => {
    const st: any = l.producto_id ? stockDe.get(l.producto_id) : null;
    const mojam = l.mojam_programa;
    return {
      id: l.id, producto: l.producto, unidad: l.unidad ?? "", conc: l.conc_100l,
      escala: l.conc_100l !== null && !(mojam !== null && mojam > 0 && mojam < 100),
      fijaHa: dosisPorHa(l, null), rep: l.repeticiones, principal: esPrincipal(l), caracter: l.caracter,
      vinculado: !!l.producto_id, stock: st ? Number(st.stock) : null, stockUnidad: st?.unidad ?? null, alternativas: l.alternativas,
    };
  });

  return (
    <>
      <Encabezado
        titulo="Registrar aplicación"
        subtitulo={`Paso 3 de 3 · ${variedad.nombre} · ${app.orden}. ${app.titulo ?? ""}`}
        volver={{ href: `/programas/aplicar?v=${variedadId}`, texto: "Cambiar aplicación" }}
      />
      {hecha.has(app.id) && <div className="mb-3"><Aviso>Esta aplicación ya se registró para {variedad.nombre} el {fecha(hecha.get(app.id))}. Si la registras de nuevo se descontará otra vez.</Aviso></div>}
      {!realMes && <div className="mb-3"><Aviso>No hay mojamiento real definido para {variedad.nombre} en {app.mes ? NOMBRE_MES[app.mes] : "este mes"}; se propone el del programa. Puedes corregir los litros aquí.</Aviso></div>}
      <section className="tarjeta p-5">
        <FormularioAplicacion variedad={variedadId} progApp={app.id} titulo={`${app.titulo ?? "Aplicación"} (${variedad.nombre})`} hoy={hoy} litrosInicial={litrosInicial} haInicial={haInicial} lineas={lf} />
      </section>
      <p className="mt-3 max-w-2xl text-xs text-tinta-suave">Las salidas quedan marcadas “hecha en la app”. Si el administrador las incluye en su próximo archivo de inventario, avísale al administrador de la app para no contarlas dos veces.</p>
    </>
  );
}
