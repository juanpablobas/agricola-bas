import Link from "next/link";
import { exigirRol } from "@/lib/auth";
import { clp, num } from "@/lib/formato";
import { hoyChile } from "@/lib/semana";
import { colorEspecie } from "@/lib/etiquetas";
import { enlaceWhatsapp } from "@/lib/whatsapp";
import { Encabezado } from "@/components/Encabezado";
import { Aviso } from "@/components/Aviso";
import { Icono } from "@/components/Icono";
import { BotonCopiar } from "@/components/BotonCopiar";
import { cargarSeguimiento } from "@/lib/seguimiento";
import { NOMBRE_MES, MESES_TEMPORADA, mesesEntre, clave, dosisPorHa, esPrincipal, leerTodo, normalizarLinea, type Aplicacion, type Linea } from "@/lib/programas";

export const metadata = { title: "Pedido de productos" };

const IVA = 1.19;
const GRUPOS = { carozo: { nombre: "Carozos", grupo: "Carozo" }, nogal: { nombre: "Nogales", grupo: "Nogal" }, todo: { nombre: "Todo el campo", grupo: null } } as const;
const PERIODOS = {
  resto: "Lo que falta de la temporada",
  mes: "Este mes",
  proximo: "Próximo mes",
  temporada: "Programa completo",
  rango: "Elegir meses",
} as const;
type Grupo = keyof typeof GRUPOS;
type Periodo = keyof typeof PERIODOS;

type Prod = { nombre: string; unidad: string; producto_id: string | null; clave: string; total: number; porEspecie: Map<string, number> };
type ProdVar = { nombre: string; unidad: string; total: number; dosis: Set<string>; apps: number };
type Var = { id: string; nombre: string; especie: string; ha: number; litros: Set<number>; sinMoj: boolean; prods: Map<string, ProdVar> };

const cant = (v: number) => num(v, v < 10 ? 2 : 1);
const mesValido = (v: string | undefined, def: number) => { const n = Number(v); return n >= 1 && n <= 12 ? n : def; };

export default async function Pedido({ searchParams }: { searchParams: Promise<{ g?: string; p?: string; e?: string; d?: string; h?: string }> }) {
  const q = await searchParams;
  const { supabase } = await exigirRol("administrador", "enc_administrativo", "enc_agricola", "propietario");
  const g: Grupo = q.g === "nogal" || q.g === "todo" ? q.g : "carozo";
  const periodo: Periodo = q.p && q.p in PERIODOS ? (q.p as Periodo) : "resto";
  const hoy = hoyChile();
  const mesActual = Number(hoy.slice(5, 7));
  const iMes = MESES_TEMPORADA.indexOf(mesActual);
  const meses =
    periodo === "temporada" ? MESES_TEMPORADA
    : periodo === "mes" ? [mesActual]
    : periodo === "proximo" ? [mesActual === 12 ? 1 : mesActual + 1]
    : periodo === "rango" ? mesesEntre(mesValido(q.d, mesActual), mesValido(q.h, mesActual))
    : MESES_TEMPORADA.slice(Math.max(0, iMes));
  const completo = periodo === "temporada";
  // Lo atrasado se suma solo si el período parte desde hoy (si compras para meses futuros, no corresponde)
  const sumaAtrasadas = !completo && meses.includes(mesActual);

  const [{ data: programas }, { data: appsRaw }, { data: pv }, { data: variedades }, { data: cuarteles }, { data: reales }, { data: hechas }, { data: refs }] = await Promise.all([
    supabase.from("programa").select("id, nombre").eq("activo", true),
    supabase.from("programa_aplicacion").select("id, programa_id, orden, titulo, estado_fenologico, fecha_estimada, mes").range(0, 999),
    supabase.from("programa_variedad").select("programa_id, variedad_id").range(0, 999),
    supabase.from("variedad").select("id, nombre, especie(nombre, grupo)").range(0, 999),
    supabase.from("v_cuartel").select("variedad_id, superficie_ha, estado_productivo").eq("activo", true).range(0, 999),
    supabase.from("mojamiento_real").select("variedad_id, mes, litros_ha").range(0, 1999),
    supabase.from("aplicacion_realizada").select("programa_aplicacion_id, variedad_id").range(0, 4999),
    supabase.from("precio_referencia").select("nombre_clave, precio").range(0, 999),
  ]);
  const seg = await cargarSeguimiento(supabase, hoy);
  const atrasada = new Set(seg.pendientes.filter((x) => x.situacion === "atrasada" || x.situacion === "reprogramada").map((x) => `${x.app_id}|${x.variedad_id}`));

  const infoVar = new Map<string, { nombre: string; especie: string; grupo: string }>(
    ((variedades ?? []) as any[]).map((v) => [v.id as string, { nombre: v.nombre as string, especie: v.especie?.nombre ?? "—", grupo: v.especie?.grupo ?? "" }] as [string, { nombre: string; especie: string; grupo: string }]),
  );
  const haPor = new Map<string, number>();
  for (const c of (cuarteles ?? []) as any[]) {
    if (!c.variedad_id || c.estado_productivo === "sin_plantar" || c.estado_productivo === "eliminado") continue;
    haPor.set(c.variedad_id, (haPor.get(c.variedad_id) ?? 0) + Number(c.superficie_ha ?? 0));
  }
  const real = new Map<string, number>(((reales ?? []) as any[]).map((r) => [`${r.variedad_id}|${r.mes}`, Number(r.litros_ha)] as [string, number]));
  const yaHecha = new Set(((hechas ?? []) as any[]).map((h) => `${h.programa_aplicacion_id}|${h.variedad_id}`));
  const precioRef = new Map<string, number>(((refs ?? []) as any[]).map((r) => [r.nombre_clave as string, Number(r.precio)] as [string, number]));

  // Variedades del grupo elegido (carozos o nogales) que están en algún programa
  const delGrupo = ((pv ?? []) as any[]).filter((x) => GRUPOS[g].grupo === null || infoVar.get(x.variedad_id)?.grupo === GRUPOS[g].grupo);
  const especiesGrupo = [...new Set(delGrupo.map((x) => infoVar.get(x.variedad_id)?.especie ?? "—"))].sort((a, b) => a.localeCompare(b, "es"));
  const especie = q.e && especiesGrupo.includes(q.e) ? q.e : null;
  const pares = delGrupo.filter((x) => !especie || infoVar.get(x.variedad_id)?.especie === especie);
  const progIds = new Set(pares.map((x) => x.programa_id as string));
  const apps = ((appsRaw ?? []) as Aplicacion[]).filter((a) => progIds.has(a.programa_id));
  const lineas = apps.length
    ? (await leerTodo<any>((d, h) => supabase.from("programa_linea").select("*").in("aplicacion_id", apps.map((a) => a.id)).order("orden").range(d, h))).map(normalizarLinea)
    : [];
  const lineasDe = new Map<string, Linea[]>();
  for (const l of lineas) if (esPrincipal(l)) lineasDe.set(l.aplicacion_id, [...(lineasDe.get(l.aplicacion_id) ?? []), l]);

  const productos = new Map<string, Prod>();
  const vars = new Map<string, Var>();
  const especies = new Set<string>();
  let nAplicaciones = 0;
  let atrasadasIncluidas = 0;

  for (const par of pares) {
    const iv = infoVar.get(par.variedad_id)!;
    const ha = haPor.get(par.variedad_id) ?? 0;
    if (ha <= 0) continue;
    for (const app of apps.filter((a) => a.programa_id === par.programa_id)) {
      const k = `${app.id}|${par.variedad_id}`;
      const enPeriodo = !!app.mes && meses.includes(app.mes);
      if (!completo) {
        if (yaHecha.has(k) || seg.omitidas.has(k)) continue;
        if (!enPeriodo && !(sumaAtrasadas && atrasada.has(k))) continue;
        if (!enPeriodo) atrasadasIncluidas++;
      } else if (!enPeriodo && app.mes) continue;
      const ls = lineasDe.get(app.id) ?? [];
      if (ls.length === 0) continue;
      nAplicaciones++;
      especies.add(iv.especie);
      const litros = app.mes ? real.get(`${par.variedad_id}|${app.mes}`) ?? null : null;
      const v = vars.get(par.variedad_id) ?? { id: par.variedad_id, nombre: iv.nombre, especie: iv.especie, ha, litros: new Set<number>(), sinMoj: false, prods: new Map<string, ProdVar>() };
      for (const l of ls) {
        const porHa = dosisPorHa(l, litros);
        const qty = porHa * ha;
        if (!(qty > 0)) continue;
        const unidad = l.unidad ?? "";
        const escala = l.conc_100l !== null && !(l.mojam_programa !== null && l.mojam_programa > 0 && l.mojam_programa < 100);
        if (escala) {
          if (litros) v.litros.add(litros);
          else {
            v.sinMoj = true;
            if (l.mojam_programa) v.litros.add(l.mojam_programa);
          }
        }
        const rep = l.repeticiones > 1 ? ` × ${num(l.repeticiones)}` : "";
        const dosisTxt = escala ? `${num(l.conc_100l!, 3)} ${unidad} por 100 L${rep}` : `${num(l.dosis_ha ?? 0, 2)} ${unidad} por ha${rep}`;
        const kp = `${l.producto_id ?? "n:" + clave(l.producto)}|${unidad}`;
        const p = productos.get(kp) ?? { nombre: l.producto, unidad, producto_id: l.producto_id, clave: clave(l.producto), total: 0, porEspecie: new Map<string, number>() };
        p.total += qty;
        p.porEspecie.set(iv.especie, (p.porEspecie.get(iv.especie) ?? 0) + qty);
        productos.set(kp, p);
        const pvv = v.prods.get(kp) ?? { nombre: l.producto, unidad, total: 0, dosis: new Set<string>(), apps: 0 };
        pvv.total += qty;
        pvv.dosis.add(dosisTxt);
        pvv.apps++;
        v.prods.set(kp, pvv);
      }
      vars.set(par.variedad_id, v);
    }
  }

  // Stock y precio de referencia (neto; se le suma IVA)
  const ids = [...new Set([...productos.values()].map((p) => p.producto_id).filter(Boolean))] as string[];
  const [{ data: stocks }, { data: ingresos }] = ids.length
    ? await Promise.all([
        supabase.from("v_stock").select("producto_id, nombre, unidad, stock").in("producto_id", ids),
        supabase.from("mov_inventario").select("producto_id, valor_unitario, fecha").eq("tipo", "ingreso").gt("valor_unitario", 0).in("producto_id", ids).order("fecha", { ascending: false }).range(0, 4999),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];
  const stockDe = new Map<string, any>(((stocks ?? []) as any[]).map((s) => [s.producto_id as string, s] as [string, any]));
  const ultimoPrecio = new Map<string, number>();
  for (const m of (ingresos ?? []) as any[]) if (!ultimoPrecio.has(m.producto_id)) ultimoPrecio.set(m.producto_id, Number(m.valor_unitario));

  const filas = [...productos.values()]
    .map((p) => {
      const st = p.producto_id ? stockDe.get(p.producto_id) : null;
      const stock = st ? Math.max(0, Number(st.stock)) : null;
      const falta = stock === null ? p.total : Math.max(0, p.total - stock);
      const precio = precioRef.get(p.clave) ?? (p.producto_id ? ultimoPrecio.get(p.producto_id) : undefined) ?? null;
      const nombre = (p.producto_id && st?.nombre) || p.nombre;
      return { ...p, nombre, stock, falta, precio, costo: precio !== null ? p.total * precio * IVA : null, costoFalta: precio !== null ? falta * precio * IVA : null };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const listaEspecies = [...especies].sort((a, b) => a.localeCompare(b, "es"));
  const listaVars = [...vars.values()].sort((a, b) => a.especie.localeCompare(b.especie, "es") || a.nombre.localeCompare(b.nombre, "es"));
  const haTotal = listaVars.reduce((s, v) => s + v.ha, 0);
  const costoTotal = filas.reduce((s, f) => s + (f.costo ?? 0), 0);
  const costoFalta = filas.reduce((s, f) => s + (f.costoFalta ?? 0), 0);
  const sinPrecio = filas.filter((f) => f.precio === null).length;
  const sinMoj = listaVars.filter((v) => v.sinMoj).map((v) => v.nombre);
  const aPedir = filas.filter((f) => f.falta > 0.0005);

  const nombrePeriodo =
    meses.length === 1 ? NOMBRE_MES[meses[0]]
    : `${NOMBRE_MES[meses[0]]} a ${NOMBRE_MES[meses[meses.length - 1]]}`;
  const nombreGrupo = especie ?? GRUPOS[g].nombre;
  const textoPedido =
    `Pedido ${nombreGrupo} (${nombrePeriodo}) – Agrícola BAS\n` +
    (aPedir.length ? aPedir.map((f) => `• ${f.nombre}: ${cant(Math.ceil(f.falta * 10) / 10)} ${f.unidad}`).join("\n") : "Con lo que hay en bodega alcanza.");

  const chip = (activo: boolean) => `inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition ${activo ? "border-verde bg-verde text-white" : "border-linea bg-white text-tinta hover:border-verde/40"}`;
  const url = (cambios: Partial<{ g: Grupo; p: Periodo; e: string | null }>) => {
    const s = new URLSearchParams({ g: cambios.g ?? g, p: cambios.p ?? periodo });
    const e = cambios.e === undefined ? (cambios.g && cambios.g !== g ? null : especie) : cambios.e;
    if (e) s.set("e", e);
    const p = cambios.p ?? periodo;
    if (p === "rango") { s.set("d", String(meses[0])); s.set("h", String(meses[meses.length - 1])); }
    return `/programas/pedido?${s}`;
  };
  const opcionesMes = MESES_TEMPORADA.map((m) => <option key={m} value={m}>{NOMBRE_MES[m].charAt(0).toUpperCase() + NOMBRE_MES[m].slice(1)}</option>);

  return (
    <>
      <Encabezado
        titulo="Pedido de productos"
        subtitulo="Cuánto producto pide el programa del asesor, con tus hectáreas, tu mojamiento y las dosis del programa."
        volver={{ href: "/programas", texto: "Programas" }}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(GRUPOS) as Grupo[]).map((k) => (
          <Link key={k} href={url({ g: k })} className={chip(g === k)}>{GRUPOS[k].nombre}</Link>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(PERIODOS) as Periodo[]).filter((k) => k !== "rango").map((k) => (
          <Link key={k} href={url({ p: k })} className={`${chip(periodo === k)} min-h-9 px-3 text-xs`}>{PERIODOS[k]}</Link>
        ))}
      </div>
      <form method="get" className={`mb-3 flex flex-wrap items-end gap-2 rounded-xl border p-3 ${periodo === "rango" ? "border-verde bg-verde-claro/40" : "border-linea bg-white"}`}>
        <input type="hidden" name="g" value={g} />
        <input type="hidden" name="p" value="rango" />
        {especie && <input type="hidden" name="e" value={especie} />}
        <p className="w-full text-sm font-medium sm:w-auto sm:self-center">Elegir meses:</p>
        <div><label htmlFor="d" className="sr-only">Desde</label><select id="d" name="d" defaultValue={meses[0]} className="entrada py-2">{opcionesMes}</select></div>
        <span className="self-center text-sm text-tinta-suave">a</span>
        <div><label htmlFor="h" className="sr-only">Hasta</label><select id="h" name="h" defaultValue={meses[meses.length - 1]} className="entrada py-2">{opcionesMes}</select></div>
        <button className="boton min-h-10 py-2">Ver</button>
      </form>
      {especiesGrupo.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-tinta-suave">Especie:</span>
          <Link href={url({ e: null })} className={`${chip(!especie)} min-h-9 px-3 text-xs`}>Todas</Link>
          {especiesGrupo.map((e) => (
            <Link key={e} href={url({ e })} className={`${chip(especie === e)} min-h-9 gap-1.5 px-3 text-xs`}>
              <span className="size-2 rounded-full" style={{ background: colorEspecie(e) }} />{e}
            </Link>
          ))}
        </div>
      )}
      {especiesGrupo.length <= 1 && <div className="mb-2" />}

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="tarjeta p-4"><p className="text-xs text-tinta-suave">Período</p><p className="mt-1 text-lg font-semibold first-letter:uppercase">{nombrePeriodo}</p></div>
        <div className="tarjeta p-4"><p className="text-xs text-tinta-suave">Superficie</p><p className="mt-1 text-2xl font-semibold tabular-nums">{num(haTotal, 1)} ha</p><p className="text-xs text-tinta-suave">{listaVars.length} variedades</p></div>
        <div className="tarjeta p-4"><p className="text-xs text-tinta-suave">Productos</p><p className="mt-1 text-2xl font-semibold tabular-nums">{filas.length}</p><p className="text-xs text-tinta-suave">{completo ? "en todo el programa" : `${aPedir.length} hay que pedir`}</p></div>
        <div className="tarjeta p-4">
          <p className="text-xs text-tinta-suave">{completo ? "Costo del programa" : "Costo de lo que falta pedir"}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{costoTotal > 0 ? `$${num((completo ? costoTotal : costoFalta) / 1_000_000, 1)} M` : "—"}</p>
          <p className="text-xs text-tinta-suave">aprox., con IVA{sinPrecio > 0 ? ` · ${sinPrecio} sin precio` : ""}</p>
        </div>
      </section>

      <div className="mb-4 flex flex-col gap-2">
        <details className="rounded-lg bg-white px-3 py-2.5 text-sm text-tinta-suave">
          <summary className="cursor-pointer font-medium text-tinta">¿Cómo se calcula?</summary>
          <p className="mt-1.5">
            Dosis por 100 L × tus litros por hectárea ÷ 100 × hectáreas de la variedad, en cada aplicación. Los productos que el asesor indica por hectárea (herbicidas, pastas) se multiplican directo por las hectáreas.
            {completo ? " Incluye lo que ya se aplicó." : " No cuenta lo que ya se registró como aplicado ni lo que marcaste como “no se hará”."} Solo cuenta el producto principal de cada aplicación, no sus alternativas.
          </p>
        </details>
        {atrasadasIncluidas > 0 && <Aviso>Se sumaron {atrasadasIncluidas} aplicaciones atrasadas o postergadas, porque igual hay que hacerlas.</Aviso>}
        {sinMoj.length > 0 && (
          <Aviso>
            En {sinMoj.join(", ")} falta tu mojamiento para algunos meses, así que se usó el litraje del programa.{" "}
            <Link href="/programas/mojamiento" className="font-medium underline">Poner mojamiento</Link>
          </Aviso>
        )}
      </div>

      {filas.length === 0 ? (
        <Aviso>No hay aplicaciones de {nombreGrupo.toLowerCase()} en este período.</Aviso>
      ) : (
        <>
          <section className="tarjeta mb-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h2 className="text-lg font-semibold">{g === "todo" && !especie ? "Total de todo el campo" : `Total ${nombreGrupo.toLowerCase()}`}</h2>
                <p className="text-sm text-tinta-suave">{completo ? "Todo lo que pide el programa en la temporada." : "“Falta pedir” ya descuenta lo que hay en bodega."}</p>
              </div>
              {!completo && (
                <div className="flex flex-wrap gap-2">
                  <a href={enlaceWhatsapp(null, textoPedido)} target="_blank" rel="noopener noreferrer" className="boton"><Icono nombre="subir" className="size-4" />Enviar por WhatsApp</a>
                  <BotonCopiar texto={textoPedido} etiqueta="Copiar pedido" />
                </div>
              )}
            </div>
            <ul className="divide-y divide-linea border-t border-linea sm:hidden">
              {filas.map((f) => (
                <li key={`${f.producto_id ?? f.clave}|${f.unidad}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{f.nombre}</p>
                    <p className="text-xs text-tinta-suave">
                      Necesita {cant(f.total)} {f.unidad}
                      {!completo && ` · bodega ${f.stock === null ? "—" : `${cant(f.stock)} ${f.unidad}`}`}
                      {f.costo !== null && ` · ${clp(Math.round(completo ? f.costo : f.costoFalta ?? 0))}`}
                    </p>
                  </div>
                  {completo ? (
                    <p className="whitespace-nowrap font-semibold tabular-nums">{cant(f.total)} {f.unidad}</p>
                  ) : (
                    <p className={`whitespace-nowrap text-right font-semibold tabular-nums ${f.falta > 0.0005 ? "text-alerta" : "text-verde"}`}>
                      {f.falta > 0.0005 ? <>{cant(f.falta)} {f.unidad}<span className="block text-[11px] font-normal text-tinta-suave">falta pedir</span></> : "Alcanza"}
                    </p>
                  )}
                </li>
              ))}
              {costoTotal > 0 && (
                <li className="flex justify-between bg-papel px-4 py-3 font-semibold"><span>Total aprox. (con IVA)</span><span className="tabular-nums">{clp(Math.round(completo ? costoTotal : costoFalta))}</span></li>
              )}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-right">Necesita</th>
                    {!completo && <th className="text-right">En bodega</th>}
                    {!completo && <th className="text-right">Falta pedir</th>}
                    <th className="text-right">Costo aprox.</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={`${f.producto_id ?? f.clave}|${f.unidad}`}>
                      <td className="min-w-40 font-medium">{f.nombre}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{cant(f.total)} {f.unidad}</td>
                      {!completo && <td className="whitespace-nowrap text-right tabular-nums text-tinta-suave">{f.stock === null ? "—" : `${cant(f.stock)} ${f.unidad}`}</td>}
                      {!completo && (
                        <td className={`whitespace-nowrap text-right font-semibold tabular-nums ${f.falta > 0.0005 ? "text-alerta" : "text-verde"}`}>
                          {f.falta > 0.0005 ? `${cant(f.falta)} ${f.unidad}` : "Alcanza"}
                        </td>
                      )}
                      <td className="whitespace-nowrap text-right tabular-nums text-tinta-suave">{f.costo === null ? "—" : clp(Math.round(completo ? f.costo : f.costoFalta ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
                {costoTotal > 0 && (
                  <tfoot>
                    <tr className="bg-papel font-semibold">
                      <td className="px-3 py-2.5" colSpan={completo ? 2 : 4}>Total aproximado (con IVA)</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{clp(Math.round(completo ? costoTotal : costoFalta))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <p className="border-t border-linea px-4 py-2.5 text-xs text-tinta-suave">
              Precio: el que anotaste en <Link href="/programas/opciones" className="underline">Opciones y precios</Link> o, si no hay, el de la última compra en bodega (neto + 19 % IVA). La bodega es una sola para todo el campo: si un producto se usa en carozos y nogales, el stock se comparte.
            </p>
          </section>

          {listaEspecies.length > 1 && (
            <section className="tarjeta mb-5 overflow-hidden">
              <h2 className="p-4 pb-1 text-lg font-semibold">Por especie</h2>
              <p className="px-4 pb-2 text-sm text-tinta-suave">Cuánto de cada producto se va a cada especie.</p>
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      {listaEspecies.map((e) => (
                        <th key={e} className="text-right"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: colorEspecie(e) }} />{e}</span></th>
                      ))}
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={`${f.producto_id ?? f.clave}|${f.unidad}`}>
                        <td className="min-w-40 font-medium">{f.nombre} <span className="text-xs font-normal text-tinta-suave">{f.unidad}</span></td>
                        {listaEspecies.map((e) => {
                          const v = f.porEspecie.get(e);
                          return <td key={e} className="whitespace-nowrap text-right tabular-nums">{v ? cant(v) : <span className="text-tinta-suave/50">—</span>}</td>;
                        })}
                        <td className="whitespace-nowrap text-right font-semibold tabular-nums">{cant(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-1 text-lg font-semibold">Por variedad</h2>
            <p className="mb-3 text-sm text-tinta-suave">Toca una variedad para ver sus productos, la dosis del programa y el mojamiento usado.</p>
            <div className="flex flex-col gap-2">
              {listaVars.map((v) => {
                const litros = [...v.litros].sort((a, b) => a - b);
                const prods = [...v.prods.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
                return (
                  <details key={v.id} className="tarjeta group overflow-hidden">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-4">
                      <Icono nombre="volver" className="size-4 -rotate-90 text-tinta-suave transition group-open:rotate-90" />
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="size-2.5 rounded-full" style={{ background: colorEspecie(v.especie) }} />
                        {v.nombre}
                        <span className="font-normal text-tinta-suave">· {v.especie}</span>
                      </span>
                      <span className="text-sm text-tinta-suave">{num(v.ha, 2)} ha · {prods.length} productos</span>
                      {litros.length > 0 && (
                        <span className="text-sm text-tinta-suave">
                          Mojamiento {litros.length === 1 ? num(litros[0]) : `${num(litros[0])} a ${num(litros[litros.length - 1])}`} L/ha
                          {v.sinMoj && <span className="pastilla ml-1.5 bg-ambar-claro text-ambar">incluye el del programa</span>}
                        </span>
                      )}
                    </summary>
                    <div className="overflow-x-auto border-t border-linea">
                      <table className="tabla">
                        <thead><tr><th>Producto</th><th>Dosis del programa</th><th className="text-right">Veces</th><th className="text-right">Total</th></tr></thead>
                        <tbody>
                          {prods.map((p) => (
                            <tr key={`${p.nombre}|${p.unidad}`}>
                              <td className="min-w-36 font-medium">{p.nombre}</td>
                              <td className="text-sm text-tinta-suave">{[...p.dosis].join(" · ")}</td>
                              <td className="text-right tabular-nums text-tinta-suave">{p.apps}</td>
                              <td className="whitespace-nowrap text-right font-semibold tabular-nums">{cant(p.total)} {p.unidad}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
          <p className="mt-4 text-xs text-tinta-suave">{nAplicaciones} aplicaciones por variedad consideradas.</p>
        </>
      )}
    </>
  );
}
