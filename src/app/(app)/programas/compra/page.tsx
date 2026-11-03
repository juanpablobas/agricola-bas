import Link from "next/link";
import { exigirRol, puede } from "@/lib/auth";
import { num } from "@/lib/formato";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { cargarSeguimiento } from "@/lib/seguimiento";
import { NOMBRE_MES, MESES_TEMPORADA, clave, dosisPorHa, esPrincipal, leerTodo, mesesEntre, normalizarLinea, type Aplicacion } from "@/lib/programas";

export const metadata = { title: "Qué comprar" };

type Acum = { nombre: string; unidad: string; producto_id: string | null; total: number; variable: number; apps: Set<string> };

export default async function Compra({ searchParams }: { searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const p = await searchParams;
  const { supabase, perfil } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");

  const mesActual = Number(new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }).slice(5, 7));
  const desde = Math.min(12, Math.max(1, Number(p.desde) || mesActual));
  const hasta = Math.min(12, Math.max(1, Number(p.hasta) || ((mesActual + 3 - 1) % 12) + 1));
  const meses = mesesEntre(desde, hasta);

  const [{ data: programas }, { data: appsRaw }, { data: pv }, { data: cuarteles }, { data: reales }, { data: hechas }, { data: variedades }] = await Promise.all([
    supabase.from("programa").select("id, nombre").eq("activo", true),
    supabase.from("programa_aplicacion").select("id, programa_id, orden, titulo, estado_fenologico, fecha_estimada, mes").range(0, 999),
    supabase.from("programa_variedad").select("programa_id, variedad_id").range(0, 999),
    supabase.from("v_cuartel").select("variedad_id, superficie_ha").eq("activo", true).range(0, 999),
    supabase.from("mojamiento_real").select("variedad_id, mes, litros_ha").range(0, 999),
    supabase.from("aplicacion_realizada").select("programa_aplicacion_id, variedad_id").range(0, 999),
    supabase.from("variedad").select("id, nombre").range(0, 999),
  ]);
  const hoyIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const seg = await cargarSeguimiento(supabase, hoyIso);
  // Lo atrasado y lo reprogramado también hay que tenerlo comprado, aunque caiga fuera del período elegido
  const extra = new Set(seg.pendientes.filter((x) => x.situacion === "atrasada" || x.situacion === "reprogramada").map((x) => `${x.app_id}|${x.variedad_id}`));
  const extraApps = new Set([...extra].map((k) => k.split("|")[0]));
  const apps = ((appsRaw ?? []) as Aplicacion[]).filter((a) => (a.mes && meses.includes(a.mes)) || extraApps.has(a.id));
  let atrasadasIncluidas = 0;
  const lineas = (await leerTodo<any>((d, h) => supabase.from("programa_linea").select("*").in("aplicacion_id", apps.map((a) => a.id)).order("orden").range(d, h))).map(normalizarLinea);

  const haPor = new Map<string, number>();
  for (const c of cuarteles ?? []) if (c.variedad_id) haPor.set(c.variedad_id, (haPor.get(c.variedad_id) ?? 0) + Number(c.superficie_ha ?? 0));
  const real = new Map<string, number>((reales ?? []).map((r: any) => [`${r.variedad_id}|${r.mes}`, Number(r.litros_ha)]));
  const yaHecha = new Set((hechas ?? []).map((h: any) => `${h.programa_aplicacion_id}|${h.variedad_id}`));
  const nombreVar = new Map((variedades ?? []).map((v: any) => [v.id as string, v.nombre as string]));

  // Productos de la bodega (stock)
  const idsProd = [...new Set(lineas.map((l) => l.producto_id).filter(Boolean))] as string[];
  const { data: stocks } = idsProd.length ? await supabase.from("v_stock").select("producto_id, nombre, unidad, stock").in("producto_id", idsProd) : { data: [] as any[] };
  const stockDe = new Map<string, any>((stocks ?? []).map((s: any) => [s.producto_id as string, s]));

  const acum = new Map<string, Acum>();
  let sinMojamiento = 0;
  const casosVistos = new Set<string>();
  for (const prog of programas ?? []) {
    const vars = (pv ?? []).filter((v: any) => v.programa_id === prog.id);
    for (const app of apps.filter((a) => a.programa_id === prog.id)) {
      for (const v of vars) {
        const par = `${app.id}|${v.variedad_id}`;
        if (yaHecha.has(par) || seg.omitidas.has(par)) continue;
        const enRango = !!app.mes && meses.includes(app.mes);
        if (!enRango && !extra.has(par)) continue;
        if (!enRango) atrasadasIncluidas++;
        const ha = haPor.get(v.variedad_id) ?? 0;
        if (ha <= 0) continue;
        const litros = real.get(`${v.variedad_id}|${app.mes}`) ?? null;
        if (litros === null) casosVistos.add(`${v.variedad_id}|${app.mes}`);
        for (const l of lineas.filter((x) => x.aplicacion_id === app.id && esPrincipal(x))) {
          const q = dosisPorHa(l, litros) * ha;
          if (!(q > 0)) continue;
          const unidad = l.unidad ?? "";
          const k = `${l.producto_id ?? "n:" + clave(l.producto)}|${unidad}`;
          const a = acum.get(k) ?? { nombre: (l.producto_id && stockDe.get(l.producto_id)?.nombre) || l.producto, unidad, producto_id: l.producto_id, total: 0, variable: 0, apps: new Set<string>() };
          a.total += q;
          if (l.caracter === "Variable") a.variable += q;
          a.apps.add(`${app.id}`);
          acum.set(k, a);
        }
      }
    }
  }
  sinMojamiento = casosVistos.size;

  const filas = [...acum.values()]
    .map((a) => {
      const st: any = a.producto_id ? stockDe.get(a.producto_id) : null;
      const stock = st ? Number(st.stock) : null;
      const falta = stock === null ? null : Math.max(0, a.total - Math.max(0, stock));
      return { ...a, stock, stockUnidad: st?.unidad as string | null, falta };
    })
    .sort((x, y) => (y.falta ?? y.total) - (x.falta ?? x.total) || x.nombre.localeCompare(y.nombre));

  const sinUnir = filas.filter((f) => f.producto_id === null);
  const aComprar = filas.filter((f) => (f.falta ?? 0) > 0.0005);
  const puedeUnir = puede(perfil.rol, "administrador", "enc_administrativo");
  const opcionesMes = MESES_TEMPORADA.map((m) => <option key={m} value={m}>{NOMBRE_MES[m]}</option>);

  return (
    <>
      <Encabezado titulo="Qué comprar" subtitulo="Productos que pide el programa en el período, comparados con lo que hay en bodega." volver={{ href: "/programas", texto: "Programas" }} />

      <form className="tarjeta mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div><label htmlFor="desde" className="etiqueta-campo">Desde</label><select id="desde" name="desde" defaultValue={desde} className="entrada">{opcionesMes}</select></div>
        <div><label htmlFor="hasta" className="etiqueta-campo">Hasta</label><select id="hasta" name="hasta" defaultValue={hasta} className="entrada">{opcionesMes}</select></div>
        <button className="boton">Calcular</button>
      </form>

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Período</p><p className="mt-1 text-lg font-semibold capitalize">{NOMBRE_MES[meses[0]]} a {NOMBRE_MES[meses[meses.length - 1]]}</p></div>
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Aplicaciones</p><p className="mt-1 text-2xl font-semibold">{apps.length}</p></div>
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Productos</p><p className="mt-1 text-2xl font-semibold">{filas.length}</p></div>
        <div className="tarjeta p-4"><p className="text-xs uppercase tracking-wide text-tinta-suave">Hay que comprar</p><p className="mt-1 text-2xl font-semibold">{aComprar.length}</p></div>
      </section>

      <div className="mb-4 flex flex-col gap-2">
        {atrasadasIncluidas > 0 && <Aviso>Se incluyeron {atrasadasIncluidas} aplicaciones atrasadas o postergadas (por variedad) que caen fuera de estos meses, porque igual hay que hacerlas. <Link href="/programas" className="font-medium underline">Ver pendientes</Link></Aviso>}
        {sinMojamiento > 0 && (
          <Aviso>
            En {sinMojamiento} combinaciones de variedad y mes todavía no hay mojamiento real, así que se usó el del programa.{" "}
            <Link href="/programas/mojamiento" className="font-medium underline">Definir mojamiento</Link>
          </Aviso>
        )}
        {sinUnir.length > 0 && (
          <Aviso>
            {sinUnir.length} productos no están unidos a la bodega (no se sabe su stock, aparecen con “—”).{" "}
            {puedeUnir && <Link href="/programas/vincular" className="font-medium underline">Unirlos</Link>}
          </Aviso>
        )}
        <p className="text-xs text-tinta-suave">
          Solo cuenta lo principal del programa (las alternativas no). Las aplicaciones ya registradas no se vuelven a contar. “Variable” es la parte que el asesor indica según la condición del campo; no siempre se usa.
          Superficies tomadas de la ficha de cuarteles.
        </p>
      </div>

      <section className="tarjeta overflow-x-auto">
        <table className="tabla">
          <thead><tr><th>Producto</th><th className="text-right">Necesita</th><th className="text-right">De eso, variable</th><th className="text-right">En bodega</th><th className="text-right">Falta</th><th className="text-right">Aplic.</th></tr></thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-tinta-suave">No hay aplicaciones en ese período.</td></tr>}
            {filas.map((f) => {
              const raro = f.stockUnidad && f.unidad && f.stockUnidad !== f.unidad;
              return (
                <tr key={`${f.producto_id ?? f.nombre}|${f.unidad}`}>
                  <td className="min-w-44 font-medium">{f.nombre}{f.producto_id === null && <span className="pastilla ml-1.5 bg-ambar-claro text-ambar">sin unir</span>}</td>
                  <td className="whitespace-nowrap text-right">{num(f.total, f.total < 10 ? 2 : 1)} {f.unidad}</td>
                  <td className="whitespace-nowrap text-right text-tinta-suave">{f.variable > 0 ? `${num(f.variable, f.variable < 10 ? 2 : 1)} ${f.unidad}` : "—"}</td>
                  <td className="whitespace-nowrap text-right">{f.stock === null ? "—" : `${num(f.stock, 1)} ${f.stockUnidad ?? ""}`}{raro && <span className="block text-xs text-alerta">unidad distinta</span>}</td>
                  <td className={`whitespace-nowrap text-right font-semibold ${(f.falta ?? 0) > 0.0005 ? "text-alerta" : "text-verde"}`}>
                    {f.falta === null ? "—" : f.falta > 0.0005 ? `${num(Math.ceil(f.falta * 10) / 10, 1)} ${f.unidad}` : "Alcanza"}
                  </td>
                  <td className="text-right text-tinta-suave">{f.apps.size}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="mt-3 text-xs text-tinta-suave">Variedades consideradas: {[...new Set((pv ?? []).map((v: any) => nombreVar.get(v.variedad_id)))].filter(Boolean).join(", ")}.</p>
    </>
  );
}
