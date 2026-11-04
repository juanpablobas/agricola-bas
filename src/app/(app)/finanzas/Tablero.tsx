"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { clp, num, pct } from "@/lib/formato";

export type Ceco = { id: string; codigo: string; nombre: string; tipo: string; ha: number | null };
export type FilaPpto = { ceco_id: string | null; item: string; mes: string; presupuesto: number };
export type FilaGasto = { f: string; c: string | null; i: string; t: number; p: string | null; d: string | null; s: boolean; l: string | null; n: string | null };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etiquetaMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const mesDe = (fecha: string) => fecha.slice(0, 7); // aaaa-mm
const SIN = "sin";

/** Semáforo del control del administrador: hasta 100 % verde, hasta 110 % ámbar, más de 110 % rojo. */
function clasePct(ppto: number, real: number) {
  if (ppto <= 0) return real > 0 ? "text-ambar" : "text-tinta-suave";
  const p = (real / ppto) * 100;
  return p <= 100 ? "text-verde" : p <= 110 ? "text-ambar" : "text-alerta";
}
const textoPct = (ppto: number, real: number) => (ppto <= 0 ? (real > 0 ? "s/p" : "—") : pct((real / ppto) * 100));

type Grupo = { clave: string; nombre: string; ppto: number; real: number; pptoAnio: number };

export function Tablero({
  temporada,
  meses,
  cecos,
  ppto,
  gastos,
  haGeneral,
}: {
  temporada: string;
  meses: string[]; // aaaa-mm de la temporada, en orden
  cecos: Ceco[];
  ppto: FilaPpto[];
  gastos: FilaGasto[];
  haGeneral: number | null;
}) {
  const ultimoConReal = useMemo(() => {
    const m = gastos.map((g) => mesDe(g.f)).sort();
    return m.length ? m[m.length - 1] : meses[0];
  }, [gastos, meses]);

  const [item, setItem] = useState("");
  const [ceco, setCeco] = useState("");
  const [desde, setDesde] = useState(meses[0]);
  const [hasta, setHasta] = useState(ultimoConReal);

  const nombreCeco = useMemo(() => new Map(cecos.map((c) => [c.id, c.nombre])), [cecos]);
  const itemsLista = useMemo(() => [...new Set([...ppto.map((p) => p.item), ...gastos.map((g) => g.i)])].sort(), [ppto, gastos]);
  const cecoLista = useMemo(() => cecos.filter((c) => c.tipo === "variedad" || c.codigo === "C111"), [cecos]);

  const pasa = (c: string | null, i: string) => (!item || i === item) && (!ceco || (c ?? SIN) === ceco);

  const pf = useMemo(() => ppto.filter((p) => pasa(p.ceco_id, p.item)), [ppto, item, ceco]); // eslint-disable-line react-hooks/exhaustive-deps
  const gf = useMemo(() => gastos.filter((g) => pasa(g.c, g.i)), [gastos, item, ceco]); // eslint-disable-line react-hooks/exhaustive-deps

  const enPeriodo = (m: string) => m >= desde && m <= hasta;
  const pAcum = pf.filter((p) => enPeriodo(mesDe(p.mes)));
  const gAcum = gf.filter((g) => enPeriodo(mesDe(g.f)));
  const pptoPer = pAcum.reduce((s, p) => s + p.presupuesto, 0);
  const realPer = gAcum.reduce((s, g) => s + g.t, 0);
  const pptoAnio = pf.reduce((s, p) => s + p.presupuesto, 0);
  const realAnio = gf.reduce((s, g) => s + g.t, 0);

  // Proyección de cierre: lo ya gastado + lo que falta del presupuesto
  const pptoResto = pf.filter((p) => mesDe(p.mes) > ultimoConReal).reduce((s, p) => s + p.presupuesto, 0);
  const pptoHastaUlt = pf.filter((p) => mesDe(p.mes) <= ultimoConReal).reduce((s, p) => s + p.presupuesto, 0);
  const realHastaUlt = gf.filter((g) => mesDe(g.f) <= ultimoConReal).reduce((s, g) => s + g.t, 0);
  const ritmo = pptoHastaUlt > 0 ? realHastaUlt / pptoHastaUlt : 1;
  const proyPlan = realHastaUlt + pptoResto;
  const proyRitmo = realHastaUlt + pptoResto * ritmo;

  // Las tablas de ítem y centro de costo ignoran su propio filtro para poder compararse y elegir otra fila
  const porItem = useMemo(() => {
    const m = new Map<string, Grupo>();
    const get = (k: string) => m.get(k) ?? m.set(k, { clave: k, nombre: k, ppto: 0, real: 0, pptoAnio: 0 }).get(k)!;
    for (const p of ppto) if (!ceco || (p.ceco_id ?? SIN) === ceco) {
      const g = get(p.item);
      g.pptoAnio += p.presupuesto;
      if (enPeriodo(mesDe(p.mes))) g.ppto += p.presupuesto;
    }
    for (const x of gastos) if (!ceco || (x.c ?? SIN) === ceco) {
      const g = get(x.i);
      if (enPeriodo(mesDe(x.f))) g.real += x.t;
    }
    return [...m.values()].sort((a, b) => b.pptoAnio - a.pptoAnio || b.real - a.real);
  }, [ppto, gastos, ceco, desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps

  const porCeco = useMemo(() => {
    const m = new Map<string, Grupo>();
    const get = (k: string) => m.get(k) ?? m.set(k, { clave: k, nombre: k === SIN ? "Sin asignar" : nombreCeco.get(k) ?? k, ppto: 0, real: 0, pptoAnio: 0 }).get(k)!;
    for (const p of ppto) if (!item || p.item === item) {
      const g = get(p.ceco_id ?? SIN);
      g.pptoAnio += p.presupuesto;
      if (enPeriodo(mesDe(p.mes))) g.ppto += p.presupuesto;
    }
    for (const x of gastos) if (!item || x.i === item) {
      const g = get(x.c ?? SIN);
      if (enPeriodo(mesDe(x.f))) g.real += x.t;
    }
    return [...m.values()].sort((a, b) => b.pptoAnio - a.pptoAnio || b.real - a.real);
  }, [ppto, gastos, item, desde, hasta, nombreCeco]); // eslint-disable-line react-hooks/exhaustive-deps

  const haDe = (k: string) => (k === SIN ? null : cecos.find((c) => c.id === k)?.ha ?? null);

  // Meses
  const porMes = meses.map((m) => ({
    m,
    ppto: pf.filter((p) => mesDe(p.mes) === m).reduce((s, p) => s + p.presupuesto, 0),
    real: gf.filter((g) => mesDe(g.f) === m).reduce((s, g) => s + g.t, 0),
  }));
  const maxMes = Math.max(...porMes.map((x) => Math.max(x.ppto, x.real)), 1);

  // Proveedores y gastos sin presupuesto (en el período y filtros elegidos)
  const provs = useMemo(() => {
    const m = new Map<string, { nombre: string; total: number; n: number }>();
    for (const g of gAcum) {
      const k = g.p ?? "Sin proveedor";
      const x = m.get(k) ?? { nombre: k, total: 0, n: 0 };
      x.total += g.t;
      x.n += 1;
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [gAcum]);
  const sinPpto = gAcum.filter((g) => g.s);
  const sinPptoTotal = sinPpto.reduce((s, g) => s + g.t, 0);
  const sinPptoTop = [...sinPpto].sort((a, b) => b.t - a.t).slice(0, 8);

  // Alertas: grupos sobre 110 % en el período
  const alertas = [
    ...porItem.filter((g) => g.ppto > 0 && g.real / g.ppto > 1.1).map((g) => ({ tipo: "Ítem", ...g })),
    ...porCeco.filter((g) => g.ppto > 0 && g.real / g.ppto > 1.1).map((g) => ({ tipo: "Centro de costo", ...g })),
  ].sort((a, b) => b.real - b.ppto - (a.real - a.ppto)).slice(0, 6);

  const hayFiltro = item || ceco || desde !== meses[0] || hasta !== ultimoConReal;
  const limpiar = () => { setItem(""); setCeco(""); setDesde(meses[0]); setHasta(ultimoConReal); };

  const Indicador = ({ titulo, valor, detalle, clase = "" }: { titulo: string; valor: string; detalle?: string; clase?: string }) => (
    <div className="tarjeta p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-tinta-suave">{titulo}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${clase}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-tinta-suave">{detalle}</p>}
    </div>
  );

  function Tabla({ titulo, grupos, primera, elegido, alElegir, conHa }: { titulo: string; grupos: Grupo[]; primera: string; elegido: string; alElegir: (k: string) => void; conHa?: boolean }) {
    const t = grupos.reduce((s, g) => ({ ppto: s.ppto + g.ppto, real: s.real + g.real, pptoAnio: s.pptoAnio + g.pptoAnio }), { ppto: 0, real: 0, pptoAnio: 0 });
    return (
      <section className="tarjeta overflow-x-auto">
        <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-3">
          <h2 className="font-semibold">{titulo}</h2>
          <p className="text-xs text-tinta-suave">Toca una fila para filtrar todo el tablero</p>
        </div>
        {/* Celular: cada línea con su barra real vs presupuesto, sin deslizar hacia el lado */}
        <ul className="divide-y divide-linea border-t border-linea sm:hidden">
          {grupos.map((g) => {
            const sel = elegido === g.clave;
            const ancho = g.ppto > 0 ? Math.min(100, (g.real / g.ppto) * 100) : g.real > 0 ? 100 : 0;
            const barra = clasePct(g.ppto, g.real).replace("text-", "bg-");
            return (
              <li key={g.clave}>
                <button type="button" onClick={() => alElegir(sel ? "" : g.clave)} className={`block w-full px-4 py-3 text-left transition active:bg-papel ${sel ? "bg-verde-claro/70" : ""}`}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium">{g.nombre}</span>
                    <span className={`shrink-0 text-sm font-semibold tabular-nums ${clasePct(g.ppto, g.real)}`}>{textoPct(g.ppto, g.real)}</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-papel">
                    <span className={`block h-full rounded-full ${barra}`} style={{ width: `${ancho}%` }} />
                  </span>
                  <span className="mt-1 flex justify-between gap-3 text-xs tabular-nums text-tinta-suave">
                    <span>Real {clp(g.real)}</span>
                    <span>Ppto {clp(g.ppto)}</span>
                  </span>
                </button>
              </li>
            );
          })}
          <li className="flex items-baseline justify-between gap-3 bg-papel/60 px-4 py-3 text-sm font-semibold">
            <span>Total</span>
            <span className="text-right tabular-nums">{clp(t.real)} <span className="font-normal text-tinta-suave">de {clp(t.ppto)}</span></span>
          </li>
        </ul>
        <table className="tabla hidden sm:table">
          <thead>
            <tr>
              <th>{primera}</th>
              <th className="text-right">Ppto período</th>
              <th className="text-right">Real</th>
              <th className="text-right">Diferencia</th>
              <th className="text-right">% ejec.</th>
              {conHa && <th className="text-right">$ / ha</th>}
              <th className="text-right">Ppto año</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => {
              const sel = elegido === g.clave;
              const ha = conHa ? haDe(g.clave) : null;
              return (
                <tr key={g.clave} onClick={() => alElegir(sel ? "" : g.clave)} className={`cursor-pointer transition hover:bg-papel ${sel ? "bg-verde-claro/70" : ""}`}>
                  <td className="font-medium">{g.nombre}</td>
                  <td className="text-right">{clp(g.ppto)}</td>
                  <td className="text-right">{clp(g.real)}</td>
                  <td className={`text-right ${g.ppto - g.real < 0 ? "text-alerta" : ""}`}>{clp(g.ppto - g.real)}</td>
                  <td className={`text-right font-medium ${clasePct(g.ppto, g.real)}`}>{textoPct(g.ppto, g.real)}</td>
                  {conHa && <td className="text-right text-tinta-suave">{ha ? clp(g.real / ha) : "—"}</td>}
                  <td className="text-right text-tinta-suave">{clp(g.pptoAnio)}</td>
                </tr>
              );
            })}
            <tr className="bg-papel/60 font-semibold">
              <td>Total</td>
              <td className="text-right">{clp(t.ppto)}</td>
              <td className="text-right">{clp(t.real)}</td>
              <td className={`text-right ${t.ppto - t.real < 0 ? "text-alerta" : ""}`}>{clp(t.ppto - t.real)}</td>
              <td className={`text-right ${clasePct(t.ppto, t.real)}`}>{textoPct(t.ppto, t.real)}</td>
              {conHa && <td />}
              <td className="text-right">{clp(t.pptoAnio)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    );
  }

  const selectCls = "entrada py-2 text-sm";
  const nombreSel = ceco ? (ceco === SIN ? "Sin asignar" : nombreCeco.get(ceco)) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Filtros */}
      <section className="tarjeta sticky top-14 z-20 grid gap-3 p-4 sm:grid-cols-2 lg:static lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <div>
          <label className="etiqueta-campo" htmlFor="f-item">Ítem</label>
          <select id="f-item" className={selectCls} value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="">Todos</option>
            {itemsLista.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta-campo" htmlFor="f-ceco">Centro de costo</label>
          <select id="f-ceco" className={selectCls} value={ceco} onChange={(e) => setCeco(e.target.value)}>
            <option value="">Todos</option>
            {cecoLista.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            <option value={SIN}>Sin asignar</option>
          </select>
        </div>
        <div>
          <label className="etiqueta-campo" htmlFor="f-desde">Desde</label>
          <select id="f-desde" className={selectCls} value={desde} onChange={(e) => { setDesde(e.target.value); if (e.target.value > hasta) setHasta(e.target.value); }}>
            {meses.map((m) => <option key={m} value={m}>{etiquetaMes(m + "-01")}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta-campo" htmlFor="f-hasta">Hasta</label>
          <select id="f-hasta" className={selectCls} value={hasta} onChange={(e) => { setHasta(e.target.value); if (e.target.value < desde) setDesde(e.target.value); }}>
            {meses.map((m) => <option key={m} value={m}>{etiquetaMes(m + "-01")}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={limpiar} disabled={!hayFiltro} className="boton-secundario w-full disabled:opacity-40">Limpiar</button>
        </div>
      </section>

      {/* Alertas */}
      {alertas.length > 0 && (
        <section className="rounded-[var(--radius-tarjeta)] border border-alerta/25 bg-alerta-claro/60 p-4">
          <h2 className="mb-2 text-sm font-semibold text-alerta">Pasados del 110 % en {etiquetaMes(desde + "-01")} a {etiquetaMes(hasta + "-01")}</h2>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {alertas.map((a) => (
              <li key={a.tipo + a.clave} className="flex items-baseline justify-between gap-3">
                <span><span className="text-xs text-tinta-suave">{a.tipo}: </span>{a.nombre}</span>
                <span className="whitespace-nowrap font-medium text-alerta">{textoPct(a.ppto, a.real)} · +{clp(a.real - a.ppto)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Indicadores */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador titulo="Presupuesto del período" valor={clp(pptoPer)} detalle={`Año completo: ${clp(pptoAnio)}`} />
        <Indicador titulo="Gasto real del período" valor={clp(realPer)} detalle={`${num(gAcum.length)} documentos`} />
        <Indicador
          titulo="Ejecución"
          valor={textoPct(pptoPer, realPer)}
          clase={clasePct(pptoPer, realPer)}
          detalle={`${pptoPer - realPer >= 0 ? "Bajo" : "Sobre"} el presupuesto por ${clp(Math.abs(pptoPer - realPer))}`}
        />
        <Indicador
          titulo="Sin presupuesto"
          valor={clp(sinPptoTotal)}
          clase={sinPptoTotal > 0 ? "text-ambar" : ""}
          detalle={realPer > 0 ? `${pct((sinPptoTotal / realPer) * 100)} del gasto del período` : undefined}
        />
      </section>

      {/* Proyección */}
      <section className="tarjeta p-5">
        <h2 className="font-semibold">Cómo podría cerrar la temporada {temporada}</h2>
        <p className="mt-0.5 text-xs text-tinta-suave">
          Con lo gastado hasta {etiquetaMes(ultimoConReal + "-01")}{nombreSel || item ? " (según el filtro de ítem y centro de costo)" : ""}. Es una estimación, no un compromiso.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-papel/70 p-3">
            <p className="text-xs text-tinta-suave">Presupuesto del año</p>
            <p className="text-lg font-semibold">{clp(pptoAnio)}</p>
          </div>
          <div className="rounded-lg bg-papel/70 p-3">
            <p className="text-xs text-tinta-suave">Si el resto se gasta como está presupuestado</p>
            <p className={`text-lg font-semibold ${clasePct(pptoAnio, proyPlan)}`}>{clp(proyPlan)}</p>
            <p className="text-xs text-tinta-suave">{textoPct(pptoAnio, proyPlan)} del presupuesto</p>
          </div>
          <div className="rounded-lg bg-papel/70 p-3">
            <p className="text-xs text-tinta-suave">Si se mantiene el ritmo actual ({pct(ritmo * 100)} de ejecución)</p>
            <p className={`text-lg font-semibold ${clasePct(pptoAnio, proyRitmo)}`}>{clp(proyRitmo)}</p>
            <p className="text-xs text-tinta-suave">{textoPct(pptoAnio, proyRitmo)} del presupuesto</p>
          </div>
        </div>
        {pptoAnio > 0 && (
          <p className="mt-3 text-sm text-tinta-suave">
            Ya se gastó {pct((realAnio / pptoAnio) * 100)} del presupuesto del año; quedan {clp(Math.max(pptoAnio - realAnio, 0))} por gastar.
          </p>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Tabla titulo="Por ítem" grupos={porItem} primera="Ítem" elegido={item} alElegir={setItem} />
        <Tabla titulo="Por centro de costo" grupos={porCeco} primera="Centro de costo" elegido={ceco} alElegir={setCeco} conHa />
      </div>
      <p className="-mt-3 text-xs text-tinta-suave">
        $ / ha usa las hectáreas de cada variedad en la app{haGeneral ? ` (General campo: ${num(haGeneral, 2)} ha del predio)` : ""}. Es el gasto real del período dividido por las hectáreas.
      </p>

      {/* Mes a mes */}
      <section className="tarjeta p-5">
        <h2 className="mb-3 font-semibold">Mes a mes</h2>
        <div className="flex flex-col gap-2.5">
          {porMes.map(({ m, ppto: pp, real: rr }) => (
            <div key={m} className={`grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 text-sm ${enPeriodo(m) ? "" : "opacity-40"}`}>
              <span className="text-tinta-suave">{etiquetaMes(m + "-01")}</span>
              <div className="flex flex-col gap-1">
                <div className="h-2 rounded-full bg-linea/60" title={`Presupuesto ${clp(pp)}`}>
                  <div className="h-2 rounded-full bg-tinta-suave/40" style={{ width: `${(pp / maxMes) * 100}%` }} />
                </div>
                <div className="h-2 rounded-full bg-linea/60" title={`Real ${clp(rr)}`}>
                  <div className={`h-2 rounded-full ${rr > pp * 1.1 ? "bg-alerta" : rr > pp ? "bg-ambar" : "bg-verde"}`} style={{ width: `${(rr / maxMes) * 100}%` }} />
                </div>
              </div>
              <span className="w-44 text-right text-xs text-tinta-suave">
                {clp(rr)} de {clp(pp)}
                {rr > 0 && <span className={`ml-1 font-medium ${clasePct(pp, rr)}`}>({textoPct(pp, rr)})</span>}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-tinta-suave">Barra gris: presupuesto. Barra de color: gasto real. Los meses fuera del período elegido se ven atenuados.</p>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Proveedores */}
        <section className="tarjeta overflow-x-auto">
          <h2 className="p-5 pb-3 font-semibold">Principales proveedores</h2>
          <table className="tabla">
            <thead><tr><th>Proveedor</th><th className="text-right">Docs</th><th className="text-right">Total</th><th className="text-right">% del gasto</th></tr></thead>
            <tbody>
              {provs.slice(0, 10).map((p) => (
                <tr key={p.nombre}>
                  <td className="max-w-64 font-medium">{p.nombre}</td>
                  <td className="text-right">{num(p.n)}</td>
                  <td className="text-right">{clp(p.total)}</td>
                  <td className="text-right text-tinta-suave">{realPer > 0 ? pct((p.total / realPer) * 100) : "—"}</td>
                </tr>
              ))}
              {provs.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-tinta-suave">Sin gastos en este período.</td></tr>}
            </tbody>
          </table>
          {provs.length > 10 && <p className="px-5 pb-4 pt-2 text-xs text-tinta-suave">Hay {provs.length - 10} proveedores más.</p>}
        </section>

        {/* Sin presupuesto */}
        <section className="tarjeta overflow-x-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-3">
            <h2 className="font-semibold">Mayores gastos sin presupuesto</h2>
            <Link href="/finanzas/gastos?sinppto=1" className="text-sm text-verde hover:underline">Ver todos ({num(sinPpto.length)})</Link>
          </div>
          <table className="tabla">
            <thead><tr><th>Detalle</th><th>Proveedor</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {sinPptoTop.map((g, k) => (
                <tr key={k}>
                  <td className="min-w-40">{g.d ?? g.l ?? "—"}<span className="block text-xs text-tinta-suave">{g.f.split("-").reverse().join("-")} · {g.i}</span></td>
                  <td className="max-w-40 text-tinta-suave">{g.p ?? "—"}</td>
                  <td className="text-right font-medium">{clp(g.t)}</td>
                </tr>
              ))}
              {sinPptoTop.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-tinta-suave">No hay gastos sin presupuesto en este período.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
